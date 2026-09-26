import { Injectable, Logger, OnApplicationBootstrap } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { randomUUID } from 'crypto';
import { In, Repository } from 'typeorm';

import { Booking } from '../../modules/bookings/entities/booking.entity';
import { Offer } from '../../modules/offers/entities/offer.entity';
import { JawwakReview } from '../../modules/reviews/entities/jawwak-review.entity';
import { UserReview } from '../../modules/reviews/entities/user-review.entity';
import { ReviewsService } from '../../modules/reviews/reviews.service';
import { User } from '../../modules/users/entities/user.entity';
import { Vendor } from '../../modules/vendors/entities/vendor.entity';
import {
  buildDemoJawwakReview,
  buildDemoReviews,
  DEMO_REVIEWERS,
} from './reviews.seed';
import { SEED_OWNER_ID, VENDOR_SEEDS } from './vendors.seed';

/// يزرع بيانات تجريبية تلقائياً عند الإقلاع في وضع التطوير
/// (مزوّدون + حجوزات + عروض) — فقط إذا كانت الجداول فارغة.
/// يمكن تعطيله بضبط SEED_ON_BOOT=false.
@Injectable()
export class SeederService implements OnApplicationBootstrap {
  private readonly logger = new Logger(SeederService.name);

  constructor(
    @InjectRepository(Vendor)
    private readonly vendorRepo: Repository<Vendor>,
    @InjectRepository(Booking)
    private readonly bookingRepo: Repository<Booking>,
    @InjectRepository(Offer)
    private readonly offerRepo: Repository<Offer>,
    @InjectRepository(UserReview)
    private readonly reviewRepo: Repository<UserReview>,
    @InjectRepository(JawwakReview)
    private readonly jawwakRepo: Repository<JawwakReview>,
    @InjectRepository(User)
    private readonly userRepo: Repository<User>,
    private readonly reviewsService: ReviewsService,
    private readonly config: ConfigService,
  ) {}

  async onApplicationBootstrap(): Promise<void> {
    const isProd = this.config.get<string>('NODE_ENV') === 'production';
    const disabled = this.config.get<string>('SEED_ON_BOOT') === 'false';
    if (isProd || disabled) return;

    await this.seedVendors();
    await this.seedBookingsAndOffers();
    await this.seedDemoReviews();
  }

  /// تقييمات تجريبية (تطوير فقط): 5–15 تقييم مستخدم لكل مكان + تقييم جوّك
  /// رسمي لعشرة أماكن. المتوسطات تُحسب من التقييمات عبر ReviewsService.
  private async seedDemoReviews(): Promise<void> {
    if ((await this.reviewRepo.count()) > 0) return;
    const vendors = await this.vendorRepo.find({
      where: { isActive: true },
      order: { createdAt: 'ASC' },
      take: VENDOR_SEEDS.length,
    });
    if (vendors.length === 0) return;

    // مستخدمون تجريبيون (نعيد استخدامهم إن وُجدوا).
    const phones = DEMO_REVIEWERS.map((_, i) => `+9665000${String(10000 + i)}`);
    const existing = await this.userRepo.find({ where: { phone: In(phones) } });
    const byPhone = new Map(existing.map((u) => [u.phone, u]));
    const users: User[] = [];
    for (const [i, name] of DEMO_REVIEWERS.entries()) {
      users.push(
        byPhone.get(phones[i]) ??
          (await this.userRepo.save(
            this.userRepo.create({ phone: phones[i], displayName: name, locale: 'ar' }),
          )),
      );
    }

    let total = 0;
    for (const [vi, vendor] of vendors.entries()) {
      const demo = buildDemoReviews(vendor.category, vi);
      await this.reviewRepo.save(
        demo.map((d) =>
          this.reviewRepo.create({
            vendorId: vendor.id,
            userId: users[d.userIndex].id,
            bookingId: null,
            overallRating: d.overallRating,
            foodRating: d.foodRating,
            serviceRating: d.serviceRating,
            ambienceRating: d.ambienceRating,
            valueRating: d.valueRating,
            experienceRating: d.experienceRating,
            reviewText: d.reviewText,
            images: [],
            tags: d.tags,
            isVerifiedVisit: true,
            helpfulCount: d.helpfulCount,
            status: 'approved',
            createdAt: new Date(Date.now() - d.daysAgo * 864e5),
          }),
        ),
      );
      total += demo.length;
      await this.reviewsService.recomputeVendor(vendor.id);

      // تقييم جوّك الرسمي لأول 10 أماكن.
      if (vi < 10) {
        const { daysAgo, ...j } = buildDemoJawwakReview(vendor.category, vi);
        await this.jawwakRepo.save(
          this.jawwakRepo.create({
            ...j,
            vendorId: vendor.id,
            visitDate: new Date(Date.now() - daysAgo * 864e5),
            images: [],
            isPublished: true,
          }),
        );
        await this.reviewsService.syncVendorJawwak(vendor.id);
      }
    }
    this.logger.log(
      `🌱 زُرع ${total} تقييم مستخدم تجريبي + ${Math.min(10, vendors.length)} تقييم جوّك (تطوير فقط).`,
    );
  }

  private async seedVendors(): Promise<void> {
    if ((await this.vendorRepo.count()) > 0) return;
    for (const v of VENDOR_SEEDS) {
      await this.vendorRepo.save(
        this.vendorRepo.create({
          ownerUserId: SEED_OWNER_ID,
          businessNameAr: v.businessNameAr,
          businessNameEn: v.businessNameEn,
          category: v.category,
          lat: v.lat,
          lng: v.lng,
          addressText: v.addressText,
          priceRange: v.priceRange,
          moodTags: v.moodTags,
          companionTags: v.companionTags,
          verified: v.verified,
          operatingHours: v.operatingHours,
          images: v.images,
          isActive: true,
        }),
      );
    }
    this.logger.log(`🌱 زُرع ${VENDOR_SEEDS.length} مزوّداً.`);
  }

  private async seedBookingsAndOffers(): Promise<void> {
    // نربط البيانات بأول متجر (نفس المتجر الذي يربطه الـ portal كـ"متجري").
    const vendor = await this.vendorRepo.findOne({
      where: { isActive: true },
      order: { createdAt: 'ASC' },
    });
    if (!vendor) return;

    if ((await this.bookingRepo.count()) === 0) {
      const statuses = ['used', 'used', 'confirmed', 'confirmed', 'cancelled', 'expired'];
      const payments = ['mada', 'apple_pay', 'wallet'];
      const now = Date.now();
      for (let i = 0; i < 18; i++) {
        const created = new Date(now - i * 36 * 3600 * 1000); // موزّعة على ~27 يوم
        await this.bookingRepo.save(
          this.bookingRepo.create({
            userId: randomUUID(),
            vendorId: vendor.id,
            moodSessionId: null,
            status: statuses[i % statuses.length] as Booking['status'],
            paymentMethod: payments[i % payments.length] as Booking['paymentMethod'],
            amount: 50 + (i % 8) * 40,
            discountPct: i % 4 === 0 ? 15 : 0,
            qrCode: null,
            createdAt: created,
            expiresAt: new Date(created.getTime() + 24 * 3600 * 1000),
          }),
        );
      }
      this.logger.log('🌱 زُرعت 18 حجزاً تجريبياً.');
    }

    if ((await this.offerRepo.count()) === 0) {
      const now = Date.now();
      await this.offerRepo.save([
        this.offerRepo.create({
          vendorId: vendor.id,
          title: 'خصم الافتتاح',
          discountPct: 25,
          startDate: new Date(now - 5 * 864e5),
          endDate: new Date(now + 10 * 864e5),
          isActive: true,
        }),
        this.offerRepo.create({
          vendorId: vendor.id,
          title: 'عرض نهاية الأسبوع',
          discountPct: 15,
          startDate: new Date(now - 20 * 864e5),
          endDate: new Date(now - 2 * 864e5),
          isActive: false,
        }),
      ]);
      this.logger.log('🌱 زُرع عرضان تجريبيان.');
    }
  }
}
