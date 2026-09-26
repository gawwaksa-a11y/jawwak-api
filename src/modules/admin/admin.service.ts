import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import { Booking } from '../bookings/entities/booking.entity';
import { MoodSession } from '../mood/entities/mood-session.entity';
import { UserReview } from '../reviews/entities/user-review.entity';
import { User } from '../users/entities/user.entity';
import { Vendor } from '../vendors/entities/vendor.entity';

export interface FounderKpis {
  vendors: number;
  usersRegistered: number;
  moodSessions: number;
  bookingsCompleted: number; // status = used
  bookingsTotal: number;
  conversionRate: number; // used ÷ moodSessions
  avgRating: number;
  activeUsers: number; // مستخدمون بدأوا جلسة مزاج على الأقل
  generatedAt: string;
}

@Injectable()
export class AdminService {
  constructor(
    @InjectRepository(Vendor) private readonly vendors: Repository<Vendor>,
    @InjectRepository(User) private readonly users: Repository<User>,
    @InjectRepository(MoodSession)
    private readonly sessions: Repository<MoodSession>,
    @InjectRepository(Booking) private readonly bookings: Repository<Booking>,
    @InjectRepository(UserReview)
    private readonly reviews: Repository<UserReview>,
  ) {}

  /// مؤشّرات النجاح للمؤسّس — محسوبة من قاعدة البيانات الفعلية.
  async kpis(): Promise<FounderKpis> {
    const [vendors, usersRegistered, moodSessions, bookingsTotal, used] =
      await Promise.all([
        this.vendors.count({ where: { isActive: true } }),
        this.users.count(),
        this.sessions.count(),
        this.bookings.count(),
        this.bookings.count({ where: { status: 'used' } }),
      ]);

    // متوسط التقييم من كل المراجعات.
    const reviews = await this.reviews.find({ where: { status: 'approved' } });
    const avgRating =
      reviews.length === 0
        ? 0
        : reviews.reduce((s, r) => s + Number(r.overallRating), 0) / reviews.length;

    // المستخدمون النشطون = من لديهم جلسة مزاج واحدة على الأقل.
    const sessions = await this.sessions.find();
    const activeUsers = new Set(sessions.map((s) => s.userId)).size;

    const conversionRate =
      moodSessions > 0 ? Number((used / moodSessions).toFixed(3)) : 0;

    return {
      vendors,
      usersRegistered,
      moodSessions,
      bookingsCompleted: used,
      bookingsTotal,
      conversionRate,
      avgRating: Number(avgRating.toFixed(2)),
      activeUsers,
      generatedAt: new Date().toISOString(),
    };
  }

  /// سلسلة زمنية يومية لآخر [days] يوماً: حجوزات وجلسات مزاج لكل يوم.
  async timeseries(
    days = 14,
  ): Promise<{ date: string; bookings: number; sessions: number }[]> {
    const [bookings, sessions] = await Promise.all([
      this.bookings.find(),
      this.sessions.find(),
    ]);

    const dayKey = (d: Date) => d.toISOString().slice(0, 10); // YYYY-MM-DD
    const bookingsByDay = new Map<string, number>();
    const sessionsByDay = new Map<string, number>();
    for (const b of bookings) {
      const k = dayKey(new Date(b.createdAt));
      bookingsByDay.set(k, (bookingsByDay.get(k) ?? 0) + 1);
    }
    for (const s of sessions) {
      const k = dayKey(new Date(s.createdAt));
      sessionsByDay.set(k, (sessionsByDay.get(k) ?? 0) + 1);
    }

    const out: { date: string; bookings: number; sessions: number }[] = [];
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    for (let i = days - 1; i >= 0; i--) {
      const d = new Date(today);
      d.setDate(today.getDate() - i);
      const k = dayKey(d);
      out.push({
        date: k,
        bookings: bookingsByDay.get(k) ?? 0,
        sessions: sessionsByDay.get(k) ?? 0,
      });
    }
    return out;
  }
}
