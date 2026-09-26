import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Cache } from 'cache-manager';
import { Repository } from 'typeorm';

import { encodeGeohash } from '../../common/utils/geohash.util';
import { VendorRow, VendorsService } from '../vendors/vendors.service';
import { MoodRequestDto } from './dto/mood-request.dto';
import { MoodSession } from './entities/mood-session.entity';

/// بطاقة توصية تُعاد للعميل.
export interface VendorCard extends VendorRow {
  score: number; // 0..1
  matchPercent: number; // 0..100
  distanceKm: number;
}

export interface RecommendResult {
  sessionId: string;
  results: VendorCard[];
}

const MAX_RADIUS_M = 15000;

// أوزان معادلة التسجيل.
const W = { mood: 0.35, companion: 0.25, budget: 0.2, distance: 0.1, rating: 0.1 };

// نطاقات الأسعار التقريبية لكل فئة (بالريال).
const PRICE_BANDS: Record<string, [number, number]> = {
  budget: [0, 100],
  mid: [50, 300],
  premium: [200, 100000],
};

@Injectable()
export class MoodService {
  constructor(
    @InjectRepository(MoodSession)
    private readonly sessionRepo: Repository<MoodSession>,
    private readonly vendorsService: VendorsService,
    @Inject(CACHE_MANAGER) private readonly cache: Cache,
  ) {}

  /// المنطق الكامل لتوليد التوصيات (كاش → استعلام → تسجيل → حفظ الجلسة).
  async recommend(dto: MoodRequestDto, userId: string): Promise<RecommendResult> {
    const geohash6 = encodeGeohash(dto.userLat, dto.userLng, 6);
    const cacheKey = `mood:${dto.mood}:${dto.companion}:${geohash6}`;

    // 1) محاولة القراءة من الكاش.
    let cards = await this.cache.get<VendorCard[]>(cacheKey);

    if (!cards) {
      // 2) استعلام PostGIS للمزوّدين ضمن 15 كم.
      const vendors = await this.vendorsService.queryNearby(
        dto.userLat,
        dto.userLng,
        MAX_RADIUS_M,
      );

      // 3) التسجيل + 4) الترتيب واختيار أعلى 3.
      cards = this.scoreAndRank(vendors, dto).slice(0, 3);

      // 5) التخزين في الكاش لمدة 15 دقيقة.
      await this.cache.set(cacheKey, cards, 15 * 60 * 1000);
    }

    // 6) إنشاء سجل جلسة المزاج دائماً (حتى مع cache hit).
    const session = await this.sessionRepo.save(
      this.sessionRepo.create({
        userId,
        companion: dto.companion as MoodSession['companion'],
        mood: dto.mood as MoodSession['mood'],
        budgetMin: dto.budgetMin,
        budgetMax: dto.budgetMax,
        timeSlot: dto.timeSlot as MoodSession['timeSlot'],
        userLat: dto.userLat,
        userLng: dto.userLng,
        results: cards.map((c) => c.id),
      }),
    );

    // 7) الإرجاع مع sessionId.
    return { sessionId: session.id, results: cards };
  }

  /// يطبّق المعادلة على قائمة المزوّدين ويرتّبها تنازلياً.
  private scoreAndRank(vendors: VendorRow[], dto: MoodRequestDto): VendorCard[] {
    const cards = vendors.map((v) => {
      const distanceM = v.distanceM ?? MAX_RADIUS_M;

      const moodMatch = v.moodTags.includes(dto.mood) ? 1 : 0;
      const companionMatch = v.companionTags.includes(dto.companion) ? 1 : 0;
      const budgetMatch = this.budgetMatch(dto.budgetMin, dto.budgetMax, v.priceRange);
      const distanceScore = this.clamp(1 - distanceM / MAX_RADIUS_M, 0, 1);
      const ratingScore = this.clamp(Number(v.avgRating) / 5, 0, 1);

      const score = this.clamp(
        W.mood * moodMatch +
          W.companion * companionMatch +
          W.budget * budgetMatch +
          W.distance * distanceScore +
          W.rating * ratingScore,
        0,
        1,
      );

      return {
        ...v,
        distanceM,
        score,
        matchPercent: Math.round(score * 100),
        distanceKm: Number((distanceM / 1000).toFixed(2)),
      };
    });

    cards.sort((a, b) => b.score - a.score || a.distanceM - b.distanceM);
    return cards;
  }

  /// تناسب الميزانية: تداخل نطاق المستخدم مع نطاق الفئة السعرية.
  private budgetMatch(min: number, max: number, priceRange: string): number {
    const band = PRICE_BANDS[priceRange] ?? [0, 100000];
    const overlap = Math.min(max, band[1]) - Math.max(min, band[0]);
    if (overlap <= 0) return 0;
    const span = Math.max(max - min, 1);
    return this.clamp(overlap / span, 0, 1);
  }

  private clamp(v: number, lo: number, hi: number): number {
    return Math.max(lo, Math.min(hi, v));
  }

  /// سجل جلسات المزاج للمستخدم.
  history(userId: string): Promise<MoodSession[]> {
    return this.sessionRepo.find({
      where: { userId },
      order: { createdAt: 'DESC' },
      take: 50,
    });
  }

  /// تسجيل المزوّد الذي اختاره المستخدم من التوصيات.
  async selectVendor(
    sessionId: string,
    vendorId: string,
    userId: string,
  ): Promise<MoodSession> {
    const session = await this.sessionRepo.findOne({
      where: { id: sessionId, userId },
    });
    if (!session) {
      throw new NotFoundException('جلسة المزاج غير موجودة');
    }
    session.selectedVendorId = vendorId;
    return this.sessionRepo.save(session);
  }
}
