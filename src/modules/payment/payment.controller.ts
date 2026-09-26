import {
  BadRequestException,
  Body,
  Controller,
  ForbiddenException,
  Get,
  Headers,
  HttpCode,
  Logger,
  NotFoundException,
  Param,
  ParseUUIDPipe,
  Post,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';

import {
  AuthUser,
  CurrentUser,
} from '../../common/decorators/current-user.decorator';
import { Booking } from '../bookings/entities/booking.entity';
import { Public } from '../../common/decorators/public.decorator';
import { BookingsService } from '../bookings/bookings.service';
import { CreateCheckoutDto } from './dto/create-checkout.dto';
import { VerifyPaymentDto } from './dto/verify-payment.dto';
import { PaymentService } from './payment.service';

@ApiTags('payments')
@ApiBearerAuth()
@Controller('payments')
export class PaymentController {
  private readonly logger = new Logger(PaymentController.name);

  constructor(
    private readonly paymentService: PaymentService,
    private readonly bookingsService: BookingsService,
    private readonly config: ConfigService,
  ) {}

  /// المبلغ المستحق للحجز بعد الخصم (decimal قد يصل كنص من Postgres).
  private static payable(b: Booking): number {
    const total = Number(b.amount) * (1 - Number(b.discountPct) / 100);
    return Math.round(total * 100) / 100;
  }

  private static assertAmount(b: Booking, paid: number | undefined): void {
    if (paid === undefined || Number.isNaN(paid)) return;
    if (Math.abs(paid - PaymentController.payable(b)) > 0.01) {
      throw new BadRequestException('مبلغ الدفع لا يطابق مبلغ الحجز');
    }
  }

  /// إنشاء جلسة دفع لحجز pending يملكه المستخدم الحالي.
  @Post('checkout')
  @ApiOperation({ summary: 'إنشاء جلسة دفع HyperPay (checkout)' })
  async createCheckout(
    @Body() dto: CreateCheckoutDto,
    @CurrentUser() user: AuthUser,
  ) {
    const booking = await this.bookingsService.getById(dto.bookingId);
    if (booking.userId !== user.id) {
      throw new ForbiddenException('لا تملك صلاحية دفع هذا الحجز');
    }
    if (booking.status !== 'pending') {
      throw new BadRequestException('هذا الحجز غير قابل للدفع (ليس pending)');
    }

    // المبلغ من الحجز نفسه — لا نثق بالمبلغ المرسل من العميل.
    const checkout = await this.paymentService.createCheckout({
      ...dto,
      amount: PaymentController.payable(booking),
    });
    // نربط الـ checkout بالحجز للتتبّع.
    await this.bookingsService.attachCheckout(booking.id, checkout.checkoutId);
    return checkout;
  }

  /// التحقق من الدفع وتأكيد الحجز (QR + نقاط + إشعارات).
  @Post('verify')
  @ApiOperation({ summary: 'التحقق من الدفع وتأكيد الحجز' })
  async verify(
    @Body() dto: VerifyPaymentDto,
    @CurrentUser() user: AuthUser,
  ) {
    const booking = await this.bookingsService.getById(dto.bookingId);
    if (booking.userId !== user.id) {
      throw new ForbiddenException('لا تملك صلاحية هذا الحجز');
    }
    // جلسة الدفع يجب أن تكون أُنشئت لهذا الحجز تحديداً (لا دفع حجز رخيص
    // ثم تطبيقه على حجز أغلى).
    if (!booking.checkoutId || booking.checkoutId !== dto.checkoutId) {
      throw new BadRequestException('جلسة الدفع لا تخص هذا الحجز');
    }

    const result = await this.paymentService.verifyPayment(
      dto.checkoutId,
      dto.paymentMethod,
    );

    if (!result.success) {
      return {
        success: false,
        pending: result.pending,
        resultCode: result.resultCode,
        message: result.resultDescription ?? 'لم يكتمل الدفع',
      };
    }

    PaymentController.assertAmount(booking, result.amount);

    const confirmed = await this.bookingsService.confirmAfterPayment(
      booking.id,
      {
        transactionId: result.transactionId ?? dto.checkoutId,
        paymentBrand: result.paymentBrand,
        resultCode: result.resultCode,
      },
    );

    return { success: true, transactionId: result.transactionId, booking: confirmed };
  }

  /// حالة الدفع الحالية للحجز.
  @Get('status/:bookingId')
  @ApiOperation({ summary: 'حالة الدفع الحالية لحجز' })
  async status(
    @Param('bookingId', ParseUUIDPipe) bookingId: string,
    @CurrentUser() user: AuthUser,
  ) {
    const booking = await this.bookingsService.getById(bookingId);
    if (booking.userId !== user.id) {
      throw new ForbiddenException('لا تملك صلاحية هذا الحجز');
    }
    return {
      bookingId: booking.id,
      status: booking.status,
      paid: booking.status === 'confirmed' || booking.status === 'used',
      transactionId: booking.transactionId,
      paymentBrand: booking.paymentBrand,
      paidAt: booking.paidAt,
    };
  }

  /// تأكيد مُحاكى للحجز — للتطوير فقط (بلا HyperPay).
  ///
  /// يعمل فقط عندما NODE_ENV != production وبوّابة الدفع غير مُهيّأة،
  /// ليعمل العرض التوضيحي الكامل (pending → confirmed → QR) بلا مفاتيح حقيقية.
  @Post('dev-confirm')
  @ApiOperation({ summary: 'تأكيد دفع مُحاكى (تطوير فقط)' })
  async devConfirm(
    @Body('bookingId', ParseUUIDPipe) bookingId: string,
    @CurrentUser() user: AuthUser,
  ) {
    const isProd = this.config.get<string>('NODE_ENV') === 'production';
    if (isProd || this.paymentService.isConfigured) {
      throw new NotFoundException();
    }

    const booking = await this.bookingsService.getById(bookingId);
    if (booking.userId !== user.id) {
      throw new ForbiddenException('لا تملك صلاحية هذا الحجز');
    }

    const confirmed = await this.bookingsService.confirmAfterPayment(bookingId, {
      transactionId: `SIMULATED-${Date.now()}`,
      paymentBrand: 'SIMULATION',
      resultCode: '000.100.110',
    });
    return { success: true, simulated: true, booking: confirmed };
  }

  /// Webhook من HyperPay (يُستدعى خادِم-لخادِم).
  ///
  /// لا نثق إلا بحمولة مشفّرة بسرّ الـ Webhook (AES-256-GCM): أي طلب غير موقّع
  /// أو معدّل يُرفض بـ 401 دون أي تغيير في الحجوزات.
  @Public()
  @Post('webhook')
  @HttpCode(200)
  @ApiOperation({ summary: 'استقبال إشعارات HyperPay (Webhook)' })
  async webhook(
    @Body() body: string | { encryptedBody?: string },
    @Headers('x-initialization-vector') iv?: string,
    @Headers('x-authentication-tag') tag?: string,
  ) {
    const bodyHex = typeof body === 'string' ? body : body?.encryptedBody ?? '';

    let payload: Record<string, any>;
    try {
      payload = this.paymentService.decryptWebhook(bodyHex, iv, tag);
    } catch (err) {
      this.logger.warn(`Webhook مرفوض: ${(err as Error).message}`);
      throw new UnauthorizedException('إشعار غير موثّق');
    }

    // البنية بعد فكّ التشفير: { type, payload: { merchantTransactionId, result, amount, ... } }
    const inner = payload?.payload ?? payload;
    const bookingId: string | undefined = inner?.merchantTransactionId;
    if (!bookingId) {
      return { received: true, handled: false };
    }

    const result = this.paymentService.mapResult(inner);
    if (result.success) {
      try {
        const booking = await this.bookingsService.getById(bookingId);
        PaymentController.assertAmount(booking, result.amount);
        await this.bookingsService.confirmAfterPayment(bookingId, {
          transactionId: result.transactionId ?? bookingId,
          paymentBrand: result.paymentBrand,
          resultCode: result.resultCode,
        });
      } catch (err) {
        this.logger.warn(
          `Webhook: تعذّر تأكيد الحجز ${bookingId}: ${(err as Error).message}`,
        );
      }
    }
    return { received: true, handled: result.success };
  }
}
