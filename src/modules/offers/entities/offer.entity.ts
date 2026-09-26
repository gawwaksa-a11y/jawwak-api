import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
} from 'typeorm';

import { idType, tsType } from '../../../config/db-driver';

@Entity('offers')
@Index(['vendorId'])
export class Offer {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: idType() })
  vendorId: string;

  @Column({ type: 'varchar', length: 120 })
  title: string;

  @Column({ type: 'int' })
  discountPct: number; // 5..50

  @Column({ type: tsType() })
  startDate: Date;

  @Column({ type: tsType() })
  endDate: Date;

  @Column({ type: 'boolean', default: true })
  isActive: boolean;

  @CreateDateColumn()
  createdAt: Date;
}
