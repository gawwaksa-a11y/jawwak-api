import { BadRequestException, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { randomUUID } from 'crypto';
import { Repository } from 'typeorm';

import { User } from '../users/entities/user.entity';
import { UsersService } from '../users/users.service';
import { PointsLedger, PointsReason } from './entities/points-ledger.entity';

export interface RewardsSummary {
  points: number;
  tier: string;
  ledger: PointsLedger[];
}

@Injectable()
export class RewardsService {
  constructor(
    @InjectRepository(PointsLedger)
    private readonly ledgerRepo: Repository<PointsLedger>,
    @InjectRepository(User)
    private readonly userRepo: Repository<User>,
    private readonly usersService: UsersService,
  ) {}

  /// منح/خصم نقاط + تسجيلها في السجل + تحديث رصيد المستخدم ومستواه.
  async award(
    userId: string,
    reason: PointsReason,
    referenceId: string | null,
    points: number,
  ): Promise<void> {
    await this.ledgerRepo.save(
      this.ledgerRepo.create({ userId, reason, referenceId, points }),
    );
    await this.usersService.addPoints(userId, points);
    await this.recomputeTier(userId);
  }

  /// تحديث مستوى المستخدم بناءً على مجموع نقاطه.
  private async recomputeTier(userId: string): Promise<void> {
    const user = await this.userRepo.findOne({ where: { id: userId } });
    if (!user) return;
    const tier =
      user.points >= 1000 ? 'gold' : user.points >= 300 ? 'silver' : 'bronze';
    if (user.tier !== tier) {
      user.tier = tier;
      await this.userRepo.save(user);
    }
  }

  async getSummary(userId: string): Promise<RewardsSummary> {
    const user = await this.usersService.findById(userId);
    const ledger = await this.ledgerRepo.find({
      where: { userId },
      order: { createdAt: 'DESC' },
      take: 50,
    });
    return { points: user?.points ?? 0, tier: user?.tier ?? 'bronze', ledger };
  }

  /// استبدال نقاط بخصم (يخصم من الرصيد).
  async redeem(
    userId: string,
    points: number,
  ): Promise<{ redeemed: number; remaining: number }> {
    const user = await this.usersService.findById(userId);
    if (!user || user.points < points) {
      throw new BadRequestException('رصيد النقاط غير كافٍ');
    }
    await this.award(userId, 'redemption', null, -points);
    return { redeemed: points, remaining: user.points - points };
  }

  /// إنشاء رمز/رابط إحالة للمستخدم.
  createReferral(userId: string): { code: string; link: string } {
    const code = randomUUID().slice(0, 8).toUpperCase();
    // في نظام حقيقي نحفظ الرمز ونمنح +15 عند أول استخدام من محال جديد.
    return {
      code,
      link: `https://jawwak.sa/invite/${code}?ref=${userId}`,
    };
  }
}
