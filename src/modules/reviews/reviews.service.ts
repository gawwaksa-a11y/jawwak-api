import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import {
  FindOptionsOrder,
  FindOptionsWhere,
  In,
  IsNull,
  MoreThan,
  MoreThanOrEqual,
  Not,
  Repository,
} from 'typeorm';

import { PaginationDto } from '../../common/dto/pagination.dto';
import { Booking } from '../bookings/entities/booking.entity';
import { RewardsService } from '../rewards/rewards.service';
import { User } from '../users/entities/user.entity';
import { Vendor } from '../vendors/entities/vendor.entity';
import { CreateUserReviewDto } from './dto/create-user-review.dto';
import {
  CreateJawwakReviewDto,
  UpdateJawwakReviewDto,
} from './dto/jawwak-review.dto';
import { ReviewsQueryDto } from './dto/reviews-query.dto';
import { JawwakReview } from './entities/jawwak-review.entity';
import { ReviewHelpfulVote } from './entities/review-helpful-vote.entity';
import { UserReview } from './entities/user-review.entity';
import {
  RatingAspect,
  REVIEW_ASPECTS,
  REVIEW_COOLDOWN_DAYS,
  REVIEW_POINTS,
  REVIEW_TAGS,
} from './review.constants';

/// عمود كل محور في user_reviews.
const ASPECT_COLUMN: Record<RatingAspect, keyof UserReview> = {
  food: 'foodRating',
  service: 'serviceRating',
  ambience: 'ambienceRating',
  value: 'valueRating',
  experience: 'experienceRating',
};

/// تقييم مستخدم كما يُعرض للعامة (مع اسم مختصر للخصوصية).
export type PublicUserReview = UserReview & { userName: string };

const num = (v: unknown): number | null =>
  v === null || v === undefined ? null : Number(v);
const round1 = (v: number) => Math.round(v * 10) / 10;

@Injectable()
export class ReviewsService {
  constructor(
    @InjectRepository(UserReview)
    private readonly reviewRepo: Repository<UserReview>,
    @InjectRepository(JawwakReview)
    private readonly jawwakRepo: Repository<JawwakReview>,
    @InjectRepository(ReviewHelpfulVote)
    private readonly voteRepo: Repository<ReviewHelpfulVote>,
    @InjectRepository(Booking)
    private readonly bookingRepo: Repository<Booking>,
    @InjectRepository(Vendor)
    private readonly vendorRepo: Repository<Vendor>,
    @InjectRepository(User)
    private readonly userRepo: Repository<User>,
    private readonly rewardsService: RewardsService,
  ) {}

  // ======================= البيانات الوصفية =======================

  /// محاور ووسوم التقييم لفئة مكان (تستخدمها شاشة إضافة التقييم).
  meta(category: string) {
    return {
      category,
      aspects: REVIEW_ASPECTS[category] ?? REVIEW_ASPECTS.restaurant,
      tags: REVIEW_TAGS[category] ?? REVIEW_TAGS.restaurant,
    };
  }

  // ======================= تقييم المستخدم =======================

  async createUserReview(
    dto: CreateUserReviewDto,
    userId: string,
  ): Promise<UserReview & { pointsAwarded: number }> {
    const vendor = await this.vendorRepo.findOne({ where: { id: dto.vendorId } });
    if (!vendor) throw new NotFoundException('المكان غير موجود');

    // 1) زيارة موثّقة: حجز مُستخدم (تم مسح QR) لهذا المستخدم في هذا المكان.
    const booking = await this.resolveVisit(dto, userId);

    // 2) لا أكثر من تقييم لنفس المكان خلال مدة التهدئة.
    const since = new Date(Date.now() - REVIEW_COOLDOWN_DAYS * 864e5);
    const recent = await this.reviewRepo.findOne({
      where: { userId, vendorId: dto.vendorId, createdAt: MoreThan(since) },
    });
    if (recent) throw new ConflictException('قيّمت هذا المكان مؤخراً');

    // 3) المحاور والوسوم يجب أن تناسب فئة المكان.
    const { aspects, tags } = this.meta(vendor.category);
    const allowed = new Set(aspects.map((a) => a.key));
    for (const [aspect, column] of Object.entries(ASPECT_COLUMN)) {
      const value = dto[column as keyof CreateUserReviewDto];
      if (value !== undefined && !allowed.has(aspect as RatingAspect)) {
        throw new BadRequestException(
          `المحور "${aspect}" لا يناسب هذا النوع من الأماكن`,
        );
      }
    }
    const invalidTag = (dto.tags ?? []).find((t) => !tags.includes(t));
    if (invalidTag) throw new BadRequestException(`وسم غير معروف: ${invalidTag}`);

    const review = await this.reviewRepo.save(
      this.reviewRepo.create({
        vendorId: dto.vendorId,
        userId,
        bookingId: booking.id,
        overallRating: dto.overallRating,
        foodRating: dto.foodRating ?? null,
        serviceRating: dto.serviceRating ?? null,
        ambienceRating: dto.ambienceRating ?? null,
        valueRating: dto.valueRating ?? null,
        experienceRating: dto.experienceRating ?? null,
        reviewText: dto.reviewText?.trim() || null,
        images: dto.images ?? [],
        tags: dto.tags ?? [],
        isVerifiedVisit: true,
        helpfulCount: 0,
        status: 'approved',
      }),
    );

    await this.recomputeVendor(dto.vendorId);
    await this.rewardsService.award(userId, 'review', review.id, REVIEW_POINTS);

    return { ...review, pointsAwarded: REVIEW_POINTS };
  }

  /// يحدّد الحجز الذي يثبت الزيارة: المحدّد صراحةً أو آخر زيارة غير مُقيّمة.
  private async resolveVisit(
    dto: CreateUserReviewDto,
    userId: string,
  ): Promise<Booking> {
    if (dto.bookingId) {
      const booking = await this.bookingRepo.findOne({
        where: { id: dto.bookingId },
      });
      if (!booking) throw new NotFoundException('الحجز غير موجود');
      if (booking.userId !== userId) {
        throw new ForbiddenException('لا تملك صلاحية تقييم هذا الحجز');
      }
      if (booking.vendorId !== dto.vendorId) {
        throw new BadRequestException('الحجز لا يخص هذا المكان');
      }
      if (booking.status !== 'used') {
        throw new BadRequestException('يجب مسح رمز الحجز (QR) قبل التقييم');
      }
      const already = await this.reviewRepo.findOne({
        where: { bookingId: booking.id },
      });
      if (already) throw new ConflictException('تم تقييم هذا الحجز مسبقاً');
      return booking;
    }

    const visits = await this.bookingRepo.find({
      where: { userId, vendorId: dto.vendorId, status: 'used' },
      order: { createdAt: 'DESC' },
    });
    if (visits.length === 0) {
      throw new BadRequestException(
        'التقييم للزيارات الموثّقة فقط: احجز عبر جوّك وامسح الرمز عند الوصول',
      );
    }
    const reviewed = await this.reviewRepo.find({
      where: { bookingId: In(visits.map((v) => v.id)) },
    });
    const reviewedIds = new Set(reviewed.map((r) => r.bookingId));
    const open = visits.find((v) => !reviewedIds.has(v.id));
    if (!open) throw new ConflictException('قيّمت كل زياراتك لهذا المكان');
    return open;
  }

  // ======================= العرض =======================

  async getVendorReviews(vendorId: string, query: ReviewsQueryDto) {
    const where: FindOptionsWhere<UserReview> = {
      vendorId,
      status: 'approved',
    };
    if (query.minRating) where.overallRating = MoreThanOrEqual(query.minRating);

    let order: FindOptionsOrder<UserReview>;
    if (query.aspect) {
      // تبويب المحور: التقييمات التي قيّمت هذا المحور، مرتّبة حسبه.
      const column = ASPECT_COLUMN[query.aspect];
      (where as Record<string, unknown>)[column] = Not(IsNull());
      order = { [column]: 'DESC', createdAt: 'DESC' };
    } else {
      const orders: Record<string, FindOptionsOrder<UserReview>> = {
        helpful: { helpfulCount: 'DESC', createdAt: 'DESC' },
        recent: { createdAt: 'DESC' },
        highest: { overallRating: 'DESC', createdAt: 'DESC' },
        lowest: { overallRating: 'ASC', createdAt: 'DESC' },
      };
      order = orders[query.sort ?? 'helpful'];
    }

    const [items, total] = await this.reviewRepo.findAndCount({
      where,
      order,
      skip: query.skip,
      take: query.limit,
    });

    const jawwakReview = await this.jawwakRepo.findOne({
      where: { vendorId, isPublished: true },
    });

    return {
      userReviews: await this.withNames(items),
      jawwakReview: jawwakReview ? this.normalizeJawwak(jawwakReview) : null,
      total,
      page: query.page,
      limit: query.limit,
      totalPages: Math.ceil(total / query.limit) || 1,
    };
  }

  async getReviewsSummary(vendorId: string) {
    const vendor = await this.vendorRepo.findOne({ where: { id: vendorId } });
    if (!vendor) throw new NotFoundException('المكان غير موجود');
    const jawwak = await this.jawwakRepo.findOne({
      where: { vendorId, isPublished: true },
    });

    return {
      category: vendor.category,
      aspects: this.meta(vendor.category).aspects,
      userRating: {
        average: Number(vendor.avgRating),
        count: vendor.ratingCount,
        distribution: vendor.ratingDistribution ?? {
          1: 0, 2: 0, 3: 0, 4: 0, 5: 0,
        },
        breakdown: {
          food: Number(vendor.avgFoodRating),
          service: Number(vendor.avgServiceRating),
          ambience: Number(vendor.avgAmbienceRating),
          value: Number(vendor.avgValueRating),
          experience: Number(vendor.avgExperienceRating),
        },
      },
      jawwakRating: jawwak
        ? {
            score: Number(jawwak.overallScore),
            visitDate: jawwak.visitDate,
            reviewerName: jawwak.reviewerName,
            summary: jawwak.summary,
            badges: jawwak.badges ?? [],
            breakdown: {
              quality: Number(jawwak.qualityScore),
              service: Number(jawwak.serviceScore),
              cleanliness: Number(jawwak.cleanlinessScore),
              value: Number(jawwak.valueScore),
              ambience: Number(jawwak.ambienceScore),
            },
          }
        : null,
      badges: vendor.jawwakBadges ?? [],
    };
  }

  /// توافق خلفي: GET /vendors/:id/reviews (تستخدمه لوحة المزوّدين).
  async findForVendorLegacy(vendorId: string, pagination: PaginationDto) {
    const [items, total] = await this.reviewRepo.findAndCount({
      where: { vendorId, status: 'approved' },
      order: { createdAt: 'DESC' },
      skip: pagination.skip,
      take: pagination.limit,
    });
    const named = await this.withNames(items);
    return {
      items: named.map((r) => ({
        ...r,
        rating: Number(r.overallRating), // الحقول القديمة
        comment: r.reviewText,
      })),
      total,
      page: pagination.page,
      limit: pagination.limit,
      totalPages: Math.ceil(total / pagination.limit) || 1,
    };
  }

  // ======================= "مفيد" =======================

  async markHelpful(reviewId: string, userId: string) {
    const review = await this.reviewRepo.findOne({ where: { id: reviewId } });
    if (!review || review.status !== 'approved') {
      throw new NotFoundException('التقييم غير موجود');
    }
    if (review.userId === userId) {
      throw new BadRequestException('لا يمكنك التصويت على تقييمك');
    }
    const voted = await this.voteRepo.findOne({ where: { reviewId, userId } });
    if (voted) return { helpfulCount: review.helpfulCount, voted: true };

    await this.voteRepo.save(this.voteRepo.create({ reviewId, userId }));
    await this.reviewRepo.increment({ id: reviewId }, 'helpfulCount', 1);
    return { helpfulCount: review.helpfulCount + 1, voted: true };
  }

  // ======================= تقييم جوّك الرسمي =======================

  async createJawwakReview(dto: CreateJawwakReviewDto) {
    const vendor = await this.vendorRepo.findOne({
      where: { id: dto.vendorId },
    });
    if (!vendor) throw new NotFoundException('المكان غير موجود');
    if (await this.jawwakRepo.findOne({ where: { vendorId: dto.vendorId } })) {
      throw new ConflictException(
        'يوجد تقييم رسمي لهذا المكان — استخدم التحديث',
      );
    }
    const saved = await this.jawwakRepo.save(
      this.jawwakRepo.create({
        ...dto,
        visitDate: new Date(dto.visitDate),
        prosTips: dto.prosTips ?? null,
        consTips: dto.consTips ?? null,
        badges: dto.badges ?? [],
        images: dto.images ?? [],
        isPublished: dto.isPublished ?? true,
      }),
    );
    await this.syncVendorJawwak(dto.vendorId);
    return this.normalizeJawwak(saved);
  }

  async updateJawwakReview(vendorId: string, dto: UpdateJawwakReviewDto) {
    const review = await this.jawwakRepo.findOne({ where: { vendorId } });
    if (!review) throw new NotFoundException('لا يوجد تقييم رسمي لهذا المكان');
    // vendorId من المسار فقط — لا يُنقل التقييم لمكان آخر.
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { vendorId: _ignored, visitDate, ...rest } = dto;
    Object.assign(review, rest);
    if (visitDate) review.visitDate = new Date(visitDate);
    const saved = await this.jawwakRepo.save(review);
    await this.syncVendorJawwak(vendorId);
    return this.normalizeJawwak(saved);
  }

  // ======================= الحسابات المجمّعة =======================

  /// يعيد حساب متوسطات المكان وتوزيع النجوم من التقييمات المعتمدة.
  /// (حساب في الكود لا SQL خام — يعمل على SQLite و Postgres بلا مشاكل أسماء الأعمدة.)
  async recomputeVendor(vendorId: string): Promise<void> {
    const reviews = await this.reviewRepo.find({
      where: { vendorId, status: 'approved' },
    });
    const avg = (vals: (number | null)[]) => {
      const nums = vals.filter((v): v is number => v !== null);
      return nums.length
        ? round1(nums.reduce((a, b) => a + b, 0) / nums.length)
        : 0;
    };
    const distribution: Record<string, number> = {
      1: 0, 2: 0, 3: 0, 4: 0, 5: 0,
    };
    for (const r of reviews) {
      const star = Math.min(5, Math.max(1, Math.floor(Number(r.overallRating))));
      distribution[star] += 1;
    }

    await this.vendorRepo.update(vendorId, {
      avgRating: avg(reviews.map((r) => num(r.overallRating))),
      ratingCount: reviews.length,
      avgFoodRating: avg(reviews.map((r) => num(r.foodRating))),
      avgServiceRating: avg(reviews.map((r) => num(r.serviceRating))),
      avgAmbienceRating: avg(reviews.map((r) => num(r.ambienceRating))),
      avgValueRating: avg(reviews.map((r) => num(r.valueRating))),
      avgExperienceRating: avg(reviews.map((r) => num(r.experienceRating))),
      ratingDistribution: distribution,
    });
  }

  /// ينسخ ملخّص تقييم جوّك المنشور إلى أعمدة المكان (للبطاقات والبحث).
  async syncVendorJawwak(vendorId: string): Promise<void> {
    const review = await this.jawwakRepo.findOne({ where: { vendorId } });
    const published = review?.isPublished ? review : null;
    await this.vendorRepo.update(vendorId, {
      jawwakScore: published ? Number(published.overallScore) : null,
      hasJawwakReview: Boolean(published),
      jawwakLastVisit: published?.visitDate ?? null,
      jawwakBadges: published?.badges ?? [],
    });
  }

  // ======================= مساعدات =======================

  /// يضيف اسماً مختصراً للمقيّم ("سارة ع.") — لا نكشف الاسم الكامل.
  private async withNames(items: UserReview[]): Promise<PublicUserReview[]> {
    const ids = [...new Set(items.map((r) => r.userId))];
    const users = ids.length
      ? await this.userRepo.find({ where: { id: In(ids) } })
      : [];
    const names = new Map(
      users.map((u) => [u.id, this.shortName(u.displayName)]),
    );
    return items.map((r) => ({
      ...r,
      overallRating: Number(r.overallRating),
      foodRating: num(r.foodRating),
      serviceRating: num(r.serviceRating),
      ambienceRating: num(r.ambienceRating),
      valueRating: num(r.valueRating),
      experienceRating: num(r.experienceRating),
      userName: names.get(r.userId) ?? 'مستخدم جوّك',
    }));
  }

  private shortName(full?: string | null): string {
    const parts = (full ?? '').trim().split(/\s+/).filter(Boolean);
    if (parts.length === 0) return 'مستخدم جوّك';
    return parts.length > 1 ? `${parts[0]} ${parts[1][0]}.` : parts[0];
  }

  private normalizeJawwak(r: JawwakReview) {
    return {
      ...r,
      overallScore: Number(r.overallScore),
      qualityScore: Number(r.qualityScore),
      serviceScore: Number(r.serviceScore),
      cleanlinessScore: Number(r.cleanlinessScore),
      valueScore: Number(r.valueScore),
      ambienceScore: Number(r.ambienceScore),
      badges: r.badges ?? [],
      images: r.images ?? [],
    };
  }
}
