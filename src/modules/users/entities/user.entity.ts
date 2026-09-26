import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

import { tsType } from '../../../config/db-driver';

export type UserTier = 'bronze' | 'silver' | 'gold';

@Entity('users')
// يُبحث بـ firebaseUid في كل طلب مصادَق.
@Index(['firebaseUid'])
export class User {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', length: 15, unique: true })
  phone: string;

  @Column({ type: 'varchar', length: 100 })
  displayName: string;

  @Column({ type: 'text', nullable: true })
  avatarUrl: string | null;

  @Column({ type: 'varchar', length: 5, default: 'ar' })
  locale: string;

  @Column({ type: 'int', default: 0 })
  points: number;

  @Column({ type: 'varchar', length: 10, default: 'bronze' })
  tier: UserTier;

  @Column({ type: 'text', nullable: true })
  deviceToken: string | null;

  @Column({ type: 'varchar', nullable: true })
  firebaseUid: string | null;

  // حذف ناعم متوافق مع نظام حماية البيانات (PDPL).
  @Column({ type: tsType(), nullable: true })
  deletedAt: Date | null;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  lastActiveAt: Date;
}
