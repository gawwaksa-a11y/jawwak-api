import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
} from 'typeorm';

import { decimalType, idType, tsType } from '../../../config/db-driver';

export type BookingStatus =
  | 'pending'
  | 'confirmed'
  | 'used'
  | 'cancelled'
  | 'expired';
export type PaymentMethod = 'apple_pay' | 'mada' | 'card' | 'wallet';

@Entity('bookings')
// فهارس: حجوزات المستخدم، إحصاءات المزوّد، ومهمة انتهاء الصلاحية المجدولة.
@Index(['userId'])
@Index(['vendorId', 'status'])
@Index(['status', 'expiresAt'])
export class Booking {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: idType() })
  userId: string;

  @Column({ type: idType() })
  vendorId: string;

  @Column({ type: idType(), nullable: true })
  moodSessionId: string | null;

  @Column({ type: 'varchar', length: 12, default: 'pending' })
  status: BookingStatus;

  @Column({ type: 'varchar', length: 12 })
  paymentMethod: PaymentMethod;

  @Column({ type: decimalType(), default: 0 })
  amount: number;

  @Column({ type: decimalType(), default: 0 })
  discountPct: number;

  @Column({ type: 'text', nullable: true })
  qrCode: string | null;

  @Column({ type: tsType(), nullable: true })
  qrScannedAt: Date | null;

  // بيانات الدفع عبر HyperPay.
  @Column({ type: 'text', nullable: true })
  checkoutId: string | null;

  @Column({ type: 'text', nullable: true })
  transactionId: string | null;

  @Column({ type: 'varchar', length: 30, nullable: true })
  paymentBrand: string | null;

  // كود نتيجة الدفع من HyperPay (مثل 000.100.110).
  @Column({ type: 'varchar', length: 20, nullable: true })
  paymentResultCode: string | null;

  @Column({ type: tsType(), nullable: true })
  paidAt: Date | null;

  @Column({ type: 'int', nullable: true })
  rating: number | null;

  @Column({ type: 'text', nullable: true })
  reviewText: string | null;

  @CreateDateColumn()
  createdAt: Date;

  @Column({ type: tsType() })
  expiresAt: Date;
}
