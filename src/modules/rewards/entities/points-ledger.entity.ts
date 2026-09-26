import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
} from 'typeorm';

import { idType } from '../../../config/db-driver';

export type PointsReason = 'booking' | 'review' | 'referral' | 'redemption';

@Entity('points_ledger')
@Index(['userId'])
export class PointsLedger {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: idType() })
  userId: string;

  // موجب للكسب (+10 حجز، +5 تقييم، +15 إحالة)، وسالب للاستبدال.
  @Column({ type: 'int' })
  points: number;

  @Column({ type: 'varchar', length: 12 })
  reason: PointsReason;

  @Column({ type: idType(), nullable: true })
  referenceId: string | null;

  @CreateDateColumn()
  createdAt: Date;
}
