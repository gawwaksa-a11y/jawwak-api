import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
} from 'typeorm';

import { arrayColumn, floatType, idType } from '../../../config/db-driver';

export type Companion = 'solo' | 'duo' | 'family' | 'group';
export type MoodType = 'calm' | 'excitement' | 'explore' | 'food';
export type TimeSlot = 'morning' | 'afternoon' | 'evening' | 'late_night';

@Entity('mood_sessions')
@Index(['userId'])
export class MoodSession {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: idType() })
  userId: string;

  @Column({ type: 'varchar', length: 10 })
  companion: Companion;

  @Column({ type: 'varchar', length: 12 })
  mood: MoodType;

  @Column({ type: 'int' })
  budgetMin: number;

  @Column({ type: 'int' })
  budgetMax: number;

  @Column({ type: 'varchar', length: 12 })
  timeSlot: TimeSlot;

  @Column({ type: floatType() })
  userLat: number;

  @Column({ type: floatType() })
  userLng: number;

  // قائمة معرّفات المزوّدين الموصى بها.
  @Column({ ...arrayColumn(), nullable: true })
  results: string[] | null;

  @Column({ type: idType(), nullable: true })
  selectedVendorId: string | null;

  @CreateDateColumn()
  createdAt: Date;
}
