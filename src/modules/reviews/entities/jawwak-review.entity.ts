import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

import {
  arrayColumn,
  decimalType,
  idType,
  tsType,
} from '../../../config/db-driver';

/// تقييم فريق جوّك الرسمي بعد زيارة ميدانية — تقييم واحد لكل مكان.
@Entity('jawwak_reviews')
export class JawwakReview {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index({ unique: true })
  @Column({ type: idType() })
  vendorId: string;

  @Column({ type: 'varchar', length: 100 })
  reviewerName: string;

  @Column({ type: tsType() })
  visitDate: Date;

  /// التقييم العام 0..5.
  @Column({ type: decimalType() })
  overallScore: number;

  // معايير مفصّلة 0..10.
  @Column({ type: decimalType() })
  qualityScore: number;

  @Column({ type: decimalType() })
  serviceScore: number;

  @Column({ type: decimalType() })
  cleanlinessScore: number;

  @Column({ type: decimalType() })
  valueScore: number;

  @Column({ type: decimalType() })
  ambienceScore: number;

  @Column({ type: 'text' })
  summary: string;

  @Column({ type: 'text' })
  detailedReview: string;

  @Column({ type: 'text', nullable: true })
  prosTips: string | null;

  @Column({ type: 'text', nullable: true })
  consTips: string | null;

  @Column(arrayColumn())
  badges: string[];

  @Column(arrayColumn())
  images: string[];

  @Column({ type: 'boolean', default: true })
  isPublished: boolean;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
