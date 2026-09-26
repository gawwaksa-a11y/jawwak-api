import { BadRequestException, UnauthorizedException } from '@nestjs/common';
import { createCipheriv, randomBytes } from 'crypto';

import { PaymentController } from '../src/modules/payment/payment.controller';
import { PaymentService } from '../src/modules/payment/payment.service';

describe('PaymentController — سلامة الدفع', () => {
  const SECRET = randomBytes(32).toString('hex');
  const user = { id: 'u-1', firebaseUid: null, isDev: false };

  let bookings: {
    getById: jest.Mock;
    confirmAfterPayment: jest.Mock;
    attachCheckout: jest.Mock;
  };
  let payments: PaymentService;
  let controller: PaymentController;
  let booking: Record<string, unknown>;

  /// يشفّر حمولة بنفس صيغة HyperPay (AES-256-GCM، hex).
  function encrypt(obj: unknown, key = SECRET) {
    const iv = randomBytes(12);
    const cipher = createCipheriv('aes-256-gcm', Buffer.from(key, 'hex'), iv);
    const body = Buffer.concat([
      cipher.update(JSON.stringify(obj), 'utf8'),
      cipher.final(),
    ]).toString('hex');
    return { body, iv: iv.toString('hex'), tag: cipher.getAuthTag().toString('hex') };
  }

  beforeEach(() => {
    booking = {
      id: 'b-1',
      userId: 'u-1',
      status: 'pending',
      amount: '350', // decimal يصل كنص من Postgres
      discountPct: '15',
      checkoutId: 'chk-1',
    };
    bookings = {
      getById: jest.fn(async () => booking),
      confirmAfterPayment: jest.fn(async () => ({ ...booking, status: 'confirmed' })),
      attachCheckout: jest.fn(),
    };
    const config = {
      get: (k: string, d?: unknown) =>
        ({
          HYPERPAY_WEBHOOK_SECRET: SECRET,
          HYPERPAY_ACCESS_TOKEN: 'tok',
          HYPERPAY_ENTITY_ID: 'ent',
        })[k] ?? d,
    };
    payments = new PaymentService(config as never);
    controller = new PaymentController(
      payments,
      bookings as never,
      { get: () => 'production' } as never,
    );
  });

  // ---------- Webhook ----------

  it('يرفض Webhook غير مشفّر (مزوّر) ولا يؤكّد الحجز', async () => {
    const forged = {
      payload: { merchantTransactionId: 'b-1', id: 'FAKE', result: { code: '000.100.110' } },
    };
    await expect(
      controller.webhook(forged as never, undefined, undefined),
    ).rejects.toBeInstanceOf(UnauthorizedException);
    expect(bookings.confirmAfterPayment).not.toHaveBeenCalled();
  });

  it('يرفض Webhook مشفّراً بمفتاح آخر', async () => {
    const e = encrypt(
      { payload: { merchantTransactionId: 'b-1', result: { code: '000.100.110' } } },
      randomBytes(32).toString('hex'),
    );
    await expect(controller.webhook(e.body, e.iv, e.tag)).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
    expect(bookings.confirmAfterPayment).not.toHaveBeenCalled();
  });

  it('يؤكّد الحجز من Webhook موثّق بمبلغ مطابق', async () => {
    const e = encrypt({
      type: 'PAYMENT',
      payload: {
        merchantTransactionId: 'b-1',
        id: 'txn-9',
        amount: '297.50', // 350 − 15%
        result: { code: '000.100.110' },
      },
    });
    const res = await controller.webhook(e.body, e.iv, e.tag);
    expect(res).toEqual({ received: true, handled: true });
    expect(bookings.confirmAfterPayment).toHaveBeenCalledWith(
      'b-1',
      expect.objectContaining({ transactionId: 'txn-9' }),
    );
  });

  it('لا يؤكّد عبر Webhook موثّق إن كان المبلغ أقل من مبلغ الحجز', async () => {
    const e = encrypt({
      payload: { merchantTransactionId: 'b-1', amount: '1.00', result: { code: '000.100.110' } },
    });
    await controller.webhook(e.body, e.iv, e.tag);
    expect(bookings.confirmAfterPayment).not.toHaveBeenCalled();
  });

  // ---------- Checkout / Verify ----------

  it('يحسب مبلغ الـ checkout من الحجز ويتجاهل مبلغ العميل', async () => {
    const spy = jest
      .spyOn(payments, 'createCheckout')
      .mockResolvedValue({ checkoutId: 'chk-1', entityId: 'ent', paymentMethod: 'mada', amount: 297.5 });

    await controller.createCheckout(
      { bookingId: 'b-1', vendorName: 'x', amount: 1, paymentMethod: 'mada' },
      user,
    );
    expect(spy).toHaveBeenCalledWith(expect.objectContaining({ amount: 297.5 }));
  });

  it('يرفض التحقق بجلسة دفع لا تخص الحجز', async () => {
    const spy = jest.spyOn(payments, 'verifyPayment');
    await expect(
      controller.verify(
        { checkoutId: 'chk-of-cheap-booking', bookingId: 'b-1', paymentMethod: 'mada' },
        user,
      ),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(spy).not.toHaveBeenCalled();
    expect(bookings.confirmAfterPayment).not.toHaveBeenCalled();
  });

  it('يرفض التحقق إن كان المبلغ المدفوع لا يطابق الحجز', async () => {
    jest.spyOn(payments, 'verifyPayment').mockResolvedValue({
      success: true, pending: false, transactionId: 't', amount: 1, resultCode: '000.100.110',
    });
    await expect(
      controller.verify({ checkoutId: 'chk-1', bookingId: 'b-1', paymentMethod: 'mada' }, user),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(bookings.confirmAfterPayment).not.toHaveBeenCalled();
  });
});
