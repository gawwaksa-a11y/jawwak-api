import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Cron, CronExpression } from '@nestjs/schedule';
import { InjectRepository } from '@nestjs/typeorm';
import { FindOptionsWhere, LessThan, Repository } from 'typeorm';

import { AuthUser } from '../../common/decorators/current-user.decorator';
import { QrUtil } from '../../common/utils/qr.util';
import { NotificationsService } from '../notifications/notifications.service';
import { RewardsService } from '../rewards/rewards.service';
import { VendorsService } from '../vendors/vendors.service';
import { CreateBookingDto } from './dto/create-booking.dto';
import { Booking } from './entities/booking.entity';

/// نتيجة دفع ناجحة تُمرَّر لتأكيد الحجز.
export interface PaymentConfirmation {
  transactionId: string;
  paymentBrand?: string;
  resultCode?: string;
}

@Injectable()
export class BookingsService {
  private readonly logger = new Logger(BookingsService.name);
  private readonly qrSecret: string;
  private readonly qrHmac: string;

  constructor(
    @InjectRepository(Booking)
    private readonly repo: Repository<Booking>,
    private readonly config: ConfigService,
    private readonly rewardsService: RewardsService,
    private readonly vendorsService: VendorsService,
    private readonly notifications: NotificationsService,
  ) {
    this.qrSecret = this.config.get<string>('QR_SECRET_KEY', 'dev-secret');
    this.qrHmac = this.config.get<string>('QR_HMAC_KEY', 'dev-hmac');
  }

  /// إنشاء حجز.
  ///
  /// - محفظة (wallet): يُؤكَّد فوراً (QR + نقاط + إشعارات).
  /// - مدى/بطاقة/Apple Pay: يُنشأ بحالة "pending" بانتظار الدفع عبر HyperPay،
  ///   ثم يُؤكَّد لاحقاً عبر [confirmAfterPayment].
  async create(dto: CreateBookingDto, userId: string): Promise<Booking> {
    const now = new Date();
    const expiresAt = new Date(now.getTime() + 24 * 60 * 60 * 1000);
    const method = dto.paymentMethod as Booking['paymentMethod'];
    const requiresOnlinePayment = method !== 'wallet';

    const booking = await this.repo.save(
      this.repo.create({
        userId,
        vendorId: dto.vendorId,
        moodSessionId: dto.moodSessionId ?? null,
        status: requiresOnlinePayment ? 'pending' : 'confirmed',
        paymentMethod: method,
        amount: dto.amount,
        discountPct: dto.discountPct ?? 0,
        expiresAt,
      }),
    );

    // المحفظة تُؤكَّد فوراً؛ الدفع الإلكتروني ينتظر تأكيد HyperPay.
    if (!requiresOnlinePayment) {
      await this.finalizeConfirmedBooking(booking);
    }

    return booking;
  }

  /// تأكيد الحجز بعد نجاح الدفع عبر HyperPay (idempotent).
  async confirmAfterPayment(
    bookingId: string,
    payment: PaymentConfirmation,
  ): Promise<Booking> {
    const booking = await this.repo.findOne({ where: { id: bookingId } });
    if (!booking) throw new NotFoundException('الحجز غير موجود');

    // إن سبق تأكيده (مثلاً وصل Webhook قبل استدعاء verify) نعيده كما هو.
    if (booking.status === 'confirmed' || booking.status === 'used') {
      return booking;
    }
    if (booking.status !== 'pending') {
      throw new BadRequestException('لا يمكن تأكيد حجز بحالته الحالية');
    }

    booking.status = 'confirmed';
    booking.transactionId = payment.transactionId;
    booking.paymentBrand = payment.paymentBrand ?? null;
    booking.paymentResultCode = payment.resultCode ?? null;
    booking.paidAt = new Date();
    await this.repo.save(booking);

    await this.finalizeConfirmedBooking(booking);
    return booking;
  }

  /// خطوات ما بعد التأكيد: توليد QR + منح النقاط + إرسال الإشعارات.
  private async finalizeConfirmedBooking(booking: Booking): Promise<void> {
    booking.qrCode = QrUtil.generate(
      {
        bookingId: booking.id,
        vendorId: booking.vendorId,
        userId: booking.userId,
        exp: booking.expiresAt.getTime(),
      },
      this.qrSecret,
      this.qrHmac,
    );
    await this.repo.save(booking);

    // منح نقاط الحجز (+10).
    await this.rewardsService.award(booking.userId, 'booking', booking.id, 10);

    // إشعارات — لا تُفشل الحجز إن تعذّر الإرسال.
    void this.notifyBookingConfirmed(booking);
  }

  private async notifyBookingConfirmed(booking: Booking): Promise<void> {
    try {
      const vendor = await this.vendorsService.findOne(booking.vendorId);
      await this.notifications.sendToUser(
        booking.userId,
        'تم تأكيد حجزك ✓',
        `حجزك في ${vendor.businessNameAr} جاهز — أظهر رمز QR عند الوصول.`,
        { type: 'booking_confirmed', bookingId: booking.id },
      );
      await this.notifications.sendToUser(
        vendor.ownerUserId,
        'حجز جديد! 🎉',
        `وصلك حجز جديد في ${vendor.businessNameAr}.`,
        { type: 'new_booking', bookingId: booking.id },
      );
    } catch (err) {
      this.logger.warn(
        `تعذّر إرسال إشعارات الحجز ${booking.id}: ${(err as Error).message}`,
      );
    }
  }

  async findAllForUser(userId: string, status?: string): Promise<Booking[]> {
    const where: FindOptionsWhere<Booking> = { userId };
    if (status) where.status = status as Booking['status'];
    return this.repo.find({ where, order: { createdAt: 'DESC' } });
  }

  async findOne(id: string, userId: string): Promise<Booking> {
    const booking = await this.repo.findOne({ where: { id } });
    if (!booking) throw new NotFoundException('الحجز غير موجود');
    if (booking.userId !== userId) {
      throw new ForbiddenException('لا تملك صلاحية عرض هذا الحجز');
    }
    return booking;
  }

  /// جلب حجز بمعرّفه فقط (للاستخدام الداخلي في مسار الدفع).
  async getById(id: string): Promise<Booking> {
    const booking = await this.repo.findOne({ where: { id } });
    if (!booking) throw new NotFoundException('الحجز غير موجود');
    return booking;
  }

  /// ربط معرّف جلسة الدفع (checkout) بالحجز للتتبّع.
  async attachCheckout(bookingId: string, checkoutId: string): Promise<void> {
    await this.repo.update({ id: bookingId }, { checkoutId });
  }

  /// المزوّد يمسح QR → يتحقق ويحدّث الحالة إلى used.
  /// يشترط أن يكون الماسح مالك المزوّد صاحب الحجز.
  async verifyQr(
    bookingId: string,
    qrCode: string,
    scanner: AuthUser,
  ): Promise<Booking> {
    const payload = QrUtil.verify(qrCode, this.qrSecret, this.qrHmac);
    if (!payload) {
      throw new BadRequestException('رمز QR غير صالح أو منتهي الصلاحية');
    }
    if (payload.bookingId !== bookingId) {
      throw new BadRequestException('رمز QR لا يطابق هذا الحجز');
    }

    const booking = await this.repo.findOne({ where: { id: bookingId } });
    if (!booking) throw new NotFoundException('الحجز غير موجود');
    await this.vendorsService.assertOwner(booking.vendorId, scanner);

    if (booking.status === 'used') {
      throw new BadRequestException('تم استخدام هذا الحجز مسبقاً');
    }
    if (booking.status !== 'confirmed') {
      throw new BadRequestException('لا يمكن استخدام حجز غير مؤكّد');
    }

    booking.status = 'used';
    booking.qrScannedAt = new Date();
    return this.repo.save(booking);
  }

  async cancel(id: string, userId: string): Promise<Booking> {
    const booking = await this.findOne(id, userId);
    if (booking.status === 'used') {
      throw new BadRequestException('لا يمكن إلغاء حجز مُستخدم');
    }
    if (booking.status === 'cancelled') {
      throw new BadRequestException('الحجز ملغى بالفعل');
    }
    booking.status = 'cancelled';
    return this.repo.save(booking);
  }

  /// مهمة مجدولة كل ساعة: تحويل الحجوزات المؤكّدة المنتهية إلى expired.
  @Cron(CronExpression.EVERY_HOUR)
  async expireStaleBookings(): Promise<void> {
    await this.repo.update(
      { status: 'confirmed', expiresAt: LessThan(new Date()) },
      { status: 'expired' },
    );
  }
}
