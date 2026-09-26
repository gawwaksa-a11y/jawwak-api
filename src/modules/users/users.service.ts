import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import { AuthUser } from '../../common/decorators/current-user.decorator';
import { PointsLedger } from '../rewards/entities/points-ledger.entity';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { User } from './entities/user.entity';

@Injectable()
export class UsersService {
  constructor(
    @InjectRepository(User)
    private readonly repo: Repository<User>,
    @InjectRepository(PointsLedger)
    private readonly ledgerRepo: Repository<PointsLedger>,
  ) {}

  findById(id: string): Promise<User | null> {
    return this.repo.findOne({ where: { id } });
  }

  findByFirebaseUid(uid: string): Promise<User | null> {
    return this.repo.findOne({ where: { firebaseUid: uid } });
  }

  /// إنشاء أو تحديث مستخدم قادم من Firebase (upsert بحسب firebaseUid/phone).
  async upsertFromAuth(dto: CreateUserDto): Promise<User> {
    let user: User | null = null;
    if (dto.firebaseUid) {
      user = await this.findByFirebaseUid(dto.firebaseUid);
    }
    user ??= await this.repo.findOne({ where: { phone: dto.phone } });

    if (user) {
      user.displayName = dto.displayName || user.displayName;
      user.locale = dto.locale ?? user.locale;
      user.firebaseUid = dto.firebaseUid ?? user.firebaseUid;
      user.deviceToken = dto.deviceToken ?? user.deviceToken;
      return this.repo.save(user);
    }

    const created = this.repo.create({
      phone: dto.phone,
      displayName: dto.displayName,
      locale: dto.locale ?? 'ar',
      firebaseUid: dto.firebaseUid ?? null,
      deviceToken: dto.deviceToken ?? null,
    });
    return this.repo.save(created);
  }

  /// يجلب المستخدم الحالي، ويُنشئ سجلاً لمستخدم التطوير عند الحاجة.
  async findOrCreate(authUser: AuthUser): Promise<User> {
    const existing = await this.findById(authUser.id);
    if (existing) return existing;

    // تطوير: قد يوجد سجل قديم بنفس الجوال لكن بمعرّف عشوائي (من إصدارات سابقة
    // لتسجيل الدخول). نعيد ربطه بمعرّف مستخدم التطوير الثابت بدل إنشاء مكرّر
    // (يفشل بقيد UNIQUE على phone)، ونعيد حساب الرصيد من سجل النقاط.
    if (authUser.isDev && authUser.phone) {
      const orphan = await this.repo.findOne({
        where: { phone: authUser.phone },
      });
      if (orphan) {
        await this.repo.update({ id: orphan.id }, { id: authUser.id });
        const { sum } = (await this.ledgerRepo
          .createQueryBuilder('l')
          .select('COALESCE(SUM(l.points), 0)', 'sum')
          .where('l.userId = :id', { id: authUser.id })
          .getRawOne<{ sum: string | number }>()) ?? { sum: 0 };
        await this.repo.update({ id: authUser.id }, { points: Number(sum) });
        return (await this.findById(authUser.id))!;
      }
    }

    // في التطوير قد لا يوجد سجل — ننشئه بنفس المعرّف.
    const created = this.repo.create({
      id: authUser.id,
      phone: authUser.phone ?? `+96650${Date.now().toString().slice(-7)}`,
      displayName: authUser.isDev ? 'مستخدم تطوير' : 'ضيف جوّك',
      firebaseUid: authUser.firebaseUid,
      locale: 'ar',
    });
    return this.repo.save(created);
  }

  async getMe(authUser: AuthUser): Promise<User> {
    return this.findOrCreate(authUser);
  }

  async updateMe(authUser: AuthUser, dto: UpdateUserDto): Promise<User> {
    const user = await this.findOrCreate(authUser);
    Object.assign(user, {
      displayName: dto.displayName ?? user.displayName,
      avatarUrl: dto.avatarUrl ?? user.avatarUrl,
      locale: dto.locale ?? user.locale,
      deviceToken: dto.deviceToken ?? user.deviceToken,
    });
    return this.repo.save(user);
  }

  /// حذف ناعم متوافق مع PDPL (يُحذف نهائياً بمهمة مجدولة بعد 30 يوماً).
  async softDeleteMe(authUser: AuthUser): Promise<{ scheduledPurgeAt: Date }> {
    const user = await this.findById(authUser.id);
    if (!user) throw new NotFoundException('المستخدم غير موجود');
    user.deletedAt = new Date();
    await this.repo.save(user);
    const purge = new Date();
    purge.setDate(purge.getDate() + 30);
    return { scheduledPurgeAt: purge };
  }

  /// تصدير كامل بيانات المستخدم (حق الوصول — PDPL).
  async exportData(authUser: AuthUser): Promise<Record<string, unknown>> {
    const user = await this.findById(authUser.id);
    if (!user) throw new NotFoundException('المستخدم غير موجود');
    return { profile: user, exportedAt: new Date().toISOString() };
  }

  /// إضافة نقاط للمستخدم (يستدعيها نظام المكافآت).
  async addPoints(userId: string, delta: number): Promise<void> {
    await this.repo.increment({ id: userId }, 'points', delta);
  }
}
