import {
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  Column,
} from 'typeorm';

import { idType } from '../../../config/db-driver';

/// تصويت "مفيد" — صوت واحد لكل مستخدم على كل تقييم (يمنع تضخيم العدّاد).
@Entity('review_helpful_votes')
@Index(['reviewId', 'userId'], { unique: true })
export class ReviewHelpfulVote {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: idType() })
  reviewId: string;

  @Column({ type: idType() })
  userId: string;

  @CreateDateColumn()
  createdAt: Date;
}
