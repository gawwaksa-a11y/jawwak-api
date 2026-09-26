import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Between, FindOptionsWhere, In, Repository } from 'typeorm';

import { AuthUser } from '../../common/decorators/current-user.decorator';
import {
  PaginatedResult,
  PaginationDto,
} from '../../common/dto/pagination.dto';
import { Booking } from '../bookings/entities/booking.entity';
import { MoodSession } from '../mood/entities/mood-session.entity';
import { CreateVendorDto } from './dto/create-vendor.dto';
import { NearbyQueryDto } from './dto/nearby-query.dto';
import { UpdateVendorDto } from './dto/update-vendor.dto';
import { VendorBookingsQueryDto } from './dto/vendor-bookings-query.dto';
import { Vendor } from './entities/vendor.entity';

const COMMISSION_PCT = 15;
// حافز التأسيس: أول 10 حجوزات لكل مزوّد بلا عمولة.
const FOUNDING_FREE_BOOKINGS = 10;

/// صف مزوّد كما تُرجعه الخدمة (مع lat/lng ومسافة اختيارية).
export interface VendorRow {
  id: string;
  ownerUserId: string;
  businessNameAr: string;
  businessNameEn: string;
  category: string;
  lat: number;
  lng: number;
  addressText: string;
  priceRange: string;
  moodTags: string[];
  companionTags: string[];
  verified: boolean;
  avgRating: number;
  ratingCount: number;
  // تقييم المستخدمين بأسماء نظام التقييم المزدوج (نفس avgRating/ratingCount).
  avgUserRating: number;
  userReviewCount: number;
  // تقييم فريق جوّك الرسمي.
  jawwakScore: number | null;
  hasJawwakReview: boolean;
  jawwakBadges: string[];
  operatingHours: Record<string, unknown>;
  images: string[];
  isActive: boolean;
  distanceM?: number;
}

const EARTH_RADIUS_M = 6371000;

@Injectable()
export class VendorsService {
  constructor(
    @InjectRepository(Vendor)
    private readonly repo: Repository<Vendor>,
    @InjectRepository(Booking)
    private readonly bookingRepo: Repository<Booking>,
    @InjectRepository(MoodSession)
    private readonly sessionRepo: Repository<MoodSession>,
  ) {}

  /// مسافة Haversine بالأمتار.
  private static distanceM(
    lat1: number,
    lng1: number,
    lat2: number,
    lng2: number,
  ): number {
    const toRad = (d: number) => (d * Math.PI) / 180;
    const dLat = toRad(lat2 - lat1);
    const dLng = toRad(lng2 - lng1);
    const a =
      Math.sin(dLat / 2) ** 2 +
      Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
    return EARTH_RADIUS_M * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  }

  /// تحويل الكيان إلى صف (مع تطبيع avgRating التي قد تأتي كنص من Postgres).
  private toRow(v: Vendor, distanceM?: number): VendorRow {
    return {
      id: v.id,
      ownerUserId: v.ownerUserId,
      businessNameAr: v.businessNameAr,
      businessNameEn: v.businessNameEn,
      category: v.category,
      lat: Number(v.lat),
      lng: Number(v.lng),
      addressText: v.addressText,
      priceRange: v.priceRange,
      moodTags: v.moodTags ?? [],
      companionTags: v.companionTags ?? [],
      verified: v.verified,
      avgRating: Number(v.avgRating),
      ratingCount: v.ratingCount,
      avgUserRating: Number(v.avgRating),
      userReviewCount: v.ratingCount,
      jawwakScore: v.jawwakScore == null ? null : Number(v.jawwakScore),
      hasJawwakReview: v.hasJawwakReview,
      jawwakBadges: v.jawwakBadges ?? [],
      operatingHours: v.operatingHours ?? {},
      images: v.images ?? [],
      isActive: v.isActive,
      distanceM,
    };
  }

  async findAll(
    pagination: PaginationDto,
    filters: { category?: string; priceRange?: string } = {},
  ): Promise<PaginatedResult<VendorRow>> {
    const where: Record<string, unknown> = { isActive: true };
    if (filters.category) where.category = filters.category;
    if (filters.priceRange) where.priceRange = filters.priceRange;

    const [items, total] = await this.repo.findAndCount({
      where,
      order: { avgRating: 'DESC' },
      skip: pagination.skip,
      take: pagination.limit,
    });

    return {
      items: items.map((v) => this.toRow(v)),
      total,
      page: pagination.page,
      limit: pagination.limit,
      totalPages: Math.ceil(total / pagination.limit) || 1,
    };
  }

  async findOne(id: string): Promise<VendorRow> {
    const v = await this.repo.findOne({ where: { id } });
    if (!v) throw new NotFoundException('المزوّد غير موجود');
    return this.toRow(v);
  }

  async nearby(dto: NearbyQueryDto): Promise<VendorRow[]> {
    return this.queryNearby(dto.lat, dto.lng, dto.radiusKm * 1000, dto.category);
  }

  /// بحث جغرافي: يجلب المزوّدين النشطين ويحسب المسافة في التطبيق (Haversine).
  /// مناسب لحجم البيانات الحالي ويعمل على Postgres و SQLite دون PostGIS.
  async queryNearby(
    lat: number,
    lng: number,
    radiusMeters: number,
    category?: string,
  ): Promise<VendorRow[]> {
    const where: Record<string, unknown> = { isActive: true };
    if (category) where.category = category;

    const vendors = await this.repo.find({ where });

    return vendors
      .map((v) => {
        const d = VendorsService.distanceM(lat, lng, Number(v.lat), Number(v.lng));
        return this.toRow(v, d);
      })
      .filter((r) => (r.distanceM ?? Infinity) <= radiusMeters)
      .sort((a, b) => (a.distanceM ?? 0) - (b.distanceM ?? 0));
  }

  async create(dto: CreateVendorDto, ownerUserId: string): Promise<VendorRow> {
    const entity = this.repo.create({
      ownerUserId,
      businessNameAr: dto.businessNameAr,
      businessNameEn: dto.businessNameEn,
      category: dto.category as Vendor['category'],
      lat: dto.lat,
      lng: dto.lng,
      addressText: dto.addressText,
      priceRange: dto.priceRange as Vendor['priceRange'],
      moodTags: dto.moodTags,
      companionTags: dto.companionTags,
      operatingHours: dto.operatingHours ?? {},
      images: dto.images ?? [],
      crNumber: dto.crNumber ?? null,
    });
    const saved = await this.repo.save(entity);
    return this.findOne(saved.id);
  }

  /// يتحقّق أن المستخدم مالك المزوّد ويعيده.
  /// مستخدم التطوير (تطوير فقط، بلا Firebase) يتجاوز الفحص لتعمل اللوحة محلياً.
  async assertOwner(vendorId: string, user: AuthUser): Promise<Vendor> {
    const vendor = await this.repo.findOne({ where: { id: vendorId } });
    if (!vendor) throw new NotFoundException('المزوّد غير موجود');
    if (!user.isDev && vendor.ownerUserId !== user.id) {
      throw new ForbiddenException('لا تملك صلاحية الوصول لهذا المزوّد');
    }
    return vendor;
  }

  async update(
    id: string,
    dto: UpdateVendorDto,
    user: AuthUser,
  ): Promise<VendorRow> {
    const vendor = await this.assertOwner(id, user);

    if (dto.lat !== undefined) vendor.lat = dto.lat;
    if (dto.lng !== undefined) vendor.lng = dto.lng;
    Object.assign(vendor, {
      businessNameAr: dto.businessNameAr ?? vendor.businessNameAr,
      businessNameEn: dto.businessNameEn ?? vendor.businessNameEn,
      category: (dto.category as Vendor['category']) ?? vendor.category,
      addressText: dto.addressText ?? vendor.addressText,
      priceRange: (dto.priceRange as Vendor['priceRange']) ?? vendor.priceRange,
      moodTags: dto.moodTags ?? vendor.moodTags,
      companionTags: dto.companionTags ?? vendor.companionTags,
      operatingHours: dto.operatingHours ?? vendor.operatingHours,
      images: dto.images ?? vendor.images,
      crNumber: dto.crNumber ?? vendor.crNumber,
    });
    await this.repo.save(vendor);
    return this.findOne(id);
  }

  /// إحصائيات المزوّد.
  async stats(id: string): Promise<Record<string, number>> {
    await this.findOne(id); // يتحقق من الوجود

    const bookings = await this.bookingRepo.count({ where: { vendorId: id } });
    const used = await this.bookingRepo.count({
      where: { vendorId: id, status: 'used' },
    });

    // المشاهدات: جلسات المزاج التي تضمّنت هذا المزوّد ضمن نتائجها.
    const sessions = await this.sessionRepo.find();
    const views = sessions.filter((s) => (s.results ?? []).includes(id)).length;

    const conversion = views > 0 ? bookings / views : 0;
    return {
      views,
      bookings,
      used,
      conversionRate: Number(conversion.toFixed(3)),
    };
  }

  /// متجر المزوّد الحالي (حسب ownerUserId). عند عدم وجوده (بيئة تطوير)
  /// نعيد أول متجر نشط كعرض تجريبي.
  async getMine(user: AuthUser): Promise<VendorRow> {
    const owned = await this.repo.findOne({ where: { ownerUserId: user.id } });
    if (owned) return this.toRow(owned);
    // لا نعيد متجر غيرك أبداً — الاستثناء الوحيد مستخدم التطوير (متجر تجريبي).
    if (!user.isDev) {
      throw new NotFoundException('لا يوجد متجر مرتبط بحسابك');
    }
    const first = await this.repo.findOne({
      where: { isActive: true },
      order: { createdAt: 'ASC' },
    });
    if (!first) throw new NotFoundException('لا يوجد متجر مرتبط بحسابك');
    return this.toRow(first);
  }

  /// حجوزات مزوّد مع ترقيم وفلترة بالحالة والتاريخ.
  async getBookings(
    vendorId: string,
    query: VendorBookingsQueryDto,
  ): Promise<PaginatedResult<Booking>> {
    await this.findOne(vendorId); // يتحقق من الوجود

    const where: FindOptionsWhere<Booking> = { vendorId };
    if (query.status) where.status = query.status as Booking['status'];
    if (query.from && query.to) {
      where.createdAt = Between(new Date(query.from), new Date(query.to));
    }

    const [items, total] = await this.bookingRepo.findAndCount({
      where,
      order: { createdAt: 'DESC' },
      skip: query.skip,
      take: query.limit,
    });

    return {
      items,
      total,
      page: query.page,
      limit: query.limit,
      totalPages: Math.ceil(total / query.limit) || 1,
    };
  }

  /// تقرير مالي مع حافز التأسيس: أول [FOUNDING_FREE_BOOKINGS] حجوزات لكل مزوّد
  /// بلا عمولة (0%)، وما بعدها بعمولة [COMMISSION_PCT].
  async getFinance(vendorId: string): Promise<Record<string, unknown>> {
    await this.findOne(vendorId);

    const paid = await this.bookingRepo.find({
      where: { vendorId, status: In(['confirmed', 'used']) },
    });

    const netOf = (b: Booking) =>
      Number(b.amount) * (1 - Number(b.discountPct) / 100);

    // ترتيب زمني تصاعدي لتحديد الحجوزات المشمولة بالإعفاء (الأقدم أولاً).
    const sortedAsc = [...paid].sort(
      (a, b) =>
        new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime(),
    );
    const commissionByBooking = new Map<string, number>();
    sortedAsc.forEach((b, i) => {
      const isFree = i < FOUNDING_FREE_BOOKINGS;
      commissionByBooking.set(
        b.id,
        isFree ? 0 : netOf(b) * (COMMISSION_PCT / 100),
      );
    });

    const totalRevenue = paid.reduce((s, b) => s + netOf(b), 0);
    const commissionRaw = paid.reduce(
      (s, b) => s + (commissionByBooking.get(b.id) ?? 0),
      0,
    );
    const commission = Math.round(commissionRaw);
    const net = Math.round(totalRevenue - commissionRaw);

    // تجزئة آخر 4 أسابيع (الأحدث أخيراً).
    const now = Date.now();
    const weekMs = 7 * 24 * 3600 * 1000;
    const weekly = Array.from({ length: 4 }).map((_, idx) => {
      const i = 3 - idx; // 3=الأقدم ... 0=الأحدث
      const start = now - (i + 1) * weekMs;
      const end = now - i * weekMs;
      const inWeek = paid.filter((b) => {
        const t = new Date(b.createdAt).getTime();
        return t >= start && t < end;
      });
      return {
        week: `الأسبوع ${idx + 1}`,
        revenue: Math.round(inWeek.reduce((s, b) => s + netOf(b), 0)),
        commission: Math.round(
          inWeek.reduce((s, b) => s + (commissionByBooking.get(b.id) ?? 0), 0),
        ),
      };
    });

    return {
      totalBookings: paid.length,
      totalRevenue: Math.round(totalRevenue),
      commissionPct: COMMISSION_PCT,
      commission,
      net,
      weekly,
      payoutStatus: 'processing',
      // حافز التأسيس.
      foundingFreeBookings: FOUNDING_FREE_BOOKINGS,
      foundingFreeUsed: Math.min(paid.length, FOUNDING_FREE_BOOKINGS),
      foundingFreeRemaining: Math.max(0, FOUNDING_FREE_BOOKINGS - paid.length),
    };
  }

  /// إعادة حساب متوسط التقييم بعد إضافة مراجعة.
}
