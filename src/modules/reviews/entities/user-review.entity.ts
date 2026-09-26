import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

import { arrayColumn, decimalType, idType } from '../../../config/db-driver';

export type ReviewStatus = 'pending' | 'approved' | 'rejected';

/// تقييم مستخدم لمكان — يشترط زيارة موثّقة (حجز مُستخدم عبر جوّك).
@Entity('user_reviews')
@Index(['vendorId', 'status'])
@Index(['userId'])
export class UserReview {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: idType() })
  vendorId: string;

  @Column({ type: idType() })
  userId: string;

  /// الحجز الذي أثبت الزيارة (تقييم واحد لكل حجز).
  @Index({ unique: true })
  @Column({ type: idType(), nullable: true })
  bookingId: string | null;

  /// التقييم العام 1..5.
  @Column({ type: decimalType() })
  overallRating: number;

  // تقييمات فرعية حسب نوع المكان (1..5، اختيارية).
  @Column({ type: decimalType(), nullable: true })
  foodRating: number | null; // الطعام/القهوة

  @Column({ type: decimalType(), nullable: true })
  serviceRating: number | null; // الخدمة/السرعة/التنظيم

  @Column({ type: decimalType(), nullable: true })
  ambienceRating: number | null; // الأجواء

  @Column({ type: decimalType(), nullable: true })
  valueRating: number | null; // القيمة مقابل السعر

  @Column({ type: decimalType(), nullable: true })
  experienceRating: number | null; // التجربة (للأنشطة/الفعاليات)

  @Column({ type: 'text', nullable: true })
  reviewText: string | null;

  /// صور مرفقة (يلزم خدمة رفع ملفات — غير مفعّلة بعد).
  @Column(arrayColumn())
  images: string[];

  /// وسوم التجربة المختارة من قائمة فئة المكان.
  @Column(arrayColumn())
  tags: string[];

  @Column({ type: 'boolean', default: false })
  isVerifiedVisit: boolean;

  @Column({ type: 'int', default: 0 })
  helpfulCount: number;

  @Column({ type: 'varchar', length: 10, default: 'approved' })
  status: ReviewStatus;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
