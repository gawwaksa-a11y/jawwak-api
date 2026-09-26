import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
} from 'typeorm';

import {
  arrayColumn,
  decimalType,
  floatType,
  idType,
  jsonType,
  tsType,
} from '../../../config/db-driver';

export type VendorCategory =
  | 'restaurant'
  | 'cafe'
  | 'activity'
  | 'food_truck'
  | 'event';
export type PriceRange = 'budget' | 'mid' | 'premium';

@Entity('vendors')
@Index(['ownerUserId'])
export class Vendor {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: idType() })
  ownerUserId: string;

  @Column({ type: 'varchar', length: 200 })
  businessNameAr: string;

  @Column({ type: 'varchar', length: 200 })
  businessNameEn: string;

  @Index()
  @Column({ type: 'varchar', length: 20 })
  category: VendorCategory;

  // الإحداثيات كأعمدة عادية (بدل PostGIS) — تُحسب المسافة في الخدمة عبر Haversine.
  @Column({ type: floatType() })
  lat: number;

  @Column({ type: floatType() })
  lng: number;

  @Column({ type: 'text' })
  addressText: string;

  @Column({ type: 'varchar', length: 20 })
  priceRange: PriceRange;

  @Column(arrayColumn())
  moodTags: string[];

  @Column(arrayColumn())
  companionTags: string[];

  @Column({ type: 'boolean', default: false })
  verified: boolean;

  // ===== تقييم المستخدمين (مصدر وحيد — يُعاد حسابه من user_reviews) =====
  // avgRating/ratingCount = متوسط وعدد تقييمات المستخدمين المعتمدة
  // (يُعرضان في الـ API أيضاً كـ avgUserRating/userReviewCount).
  @Column({ type: decimalType(), default: 0 })
  avgRating: number;

  @Column({ type: 'int', default: 0 })
  ratingCount: number;

  @Column({ type: decimalType(), default: 0 })
  avgFoodRating: number;

  @Column({ type: decimalType(), default: 0 })
  avgServiceRating: number;

  @Column({ type: decimalType(), default: 0 })
  avgAmbienceRating: number;

  @Column({ type: decimalType(), default: 0 })
  avgValueRating: number;

  @Column({ type: decimalType(), default: 0 })
  avgExperienceRating: number;

  /// توزيع النجوم {"1":0,…,"5":0}.
  @Column({ type: jsonType(), nullable: true })
  ratingDistribution: Record<string, number> | null;

  // ===== تقييم فريق جوّك الرسمي =====
  @Column({ type: decimalType(), nullable: true })
  jawwakScore: number | null; // 0..5

  @Column({ type: 'boolean', default: false })
  hasJawwakReview: boolean;

  @Column({ type: tsType(), nullable: true })
  jawwakLastVisit: Date | null;

  @Column({ ...arrayColumn(), nullable: true })
  jawwakBadges: string[] | null;

  @Column({ type: jsonType(), nullable: true })
  operatingHours: Record<string, unknown> | null;

  @Column(arrayColumn())
  images: string[];

  @Column({ type: 'varchar', length: 20, nullable: true })
  crNumber: string | null;

  @Column({ type: tsType(), nullable: true })
  contractSignedAt: Date | null;

  @Column({ type: 'boolean', default: true })
  isActive: boolean;

  @CreateDateColumn()
  createdAt: Date;
}
