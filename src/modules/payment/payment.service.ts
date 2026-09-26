import {
  BadRequestException,
  Injectable,
  Logger,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createDecipheriv } from 'crypto';

import { CheckoutMethod, CreateCheckoutDto } from './dto/create-checkout.dto';

export interface CheckoutResponse {
  checkoutId: string;
  entityId: string;
  paymentMethod: CheckoutMethod;
  amount: number;
}

export interface PaymentResult {
  success: boolean;
  pending: boolean;
  transactionId?: string;
  amount?: number;
  currency?: string;
  paymentBrand?: string;
  resultCode?: string;
  resultDescription?: string;
}

// كودات النتيجة من HyperPay (https://hyperpay.docs.oppwa.com).
const SUCCESS_CODES = /^(000\.000\.|000\.100\.1|000\.[36])/;
const PENDING_CODES = /^(000\.200)/;

@Injectable()
export class PaymentService {
  private readonly logger = new Logger(PaymentService.name);
  private readonly baseUrl: string;
  private readonly accessToken: string;
  private readonly entityId: string;
  private readonly madaEntityId: string;
  private readonly webhookSecret: string;

  constructor(private readonly config: ConfigService) {
    this.baseUrl = this.config.get<string>(
      'HYPERPAY_BASE_URL',
      'https://eu-test.oppwa.com',
    );
    this.accessToken = this.config.get<string>('HYPERPAY_ACCESS_TOKEN', '');
    this.entityId = this.config.get<string>('HYPERPAY_ENTITY_ID', '');
    // في حال عدم وجود معرّف مدى مستقل نستخدم المعرّف الافتراضي.
    this.madaEntityId =
      this.config.get<string>('HYPERPAY_MADA_ENTITY_ID', '') || this.entityId;
    // مفتاح فكّ تشفير إشعارات الـ Webhook (hex، 64 خانة) من لوحة HyperPay.
    this.webhookSecret = this.config.get<string>('HYPERPAY_WEBHOOK_SECRET', '');
  }

  /// هل تمّت تهيئة بيانات HyperPay؟ (يمنع الأعطال في التطوير بلا مفاتيح.)
  get isConfigured(): boolean {
    return Boolean(this.accessToken && this.entityId);
  }

  private assertConfigured(): void {
    if (!this.isConfigured) {
      throw new ServiceUnavailableException(
        'بوّابة الدفع غير مُهيّأة — أضف HYPERPAY_ENTITY_ID و HYPERPAY_ACCESS_TOKEN.',
      );
    }
  }

  private entityFor(method: CheckoutMethod): string {
    return method === 'mada' ? this.madaEntityId : this.entityId;
  }

  /// الخطوة 1: إنشاء جلسة دفع (checkout) وإرجاع معرّفها للعميل.
  async createCheckout(
    dto: CreateCheckoutDto & { amount: number },
  ): Promise<CheckoutResponse> {
    this.assertConfigured();
    const entityId = this.entityFor(dto.paymentMethod);

    const params = new URLSearchParams({
      entityId,
      amount: dto.amount.toFixed(2),
      currency: 'SAR',
      paymentType: 'DB',
      merchantTransactionId: dto.bookingId,
      'customer.email': dto.customerEmail ?? 'customer@jawwak.app',
      'billing.street1': 'الرياض',
      'billing.city': 'الرياض',
      'billing.state': 'الرياض',
      'billing.country': 'SA',
      'billing.postcode': '11564',
      descriptor: `جوّك - ${dto.vendorName}`.slice(0, 127),
    });

    const data = await this.request(
      `${this.baseUrl}/v1/checkouts`,
      { method: 'POST', body: params.toString() },
    );

    if (!data.id) {
      this.logger.warn(
        `فشل إنشاء checkout: ${JSON.stringify(data.result ?? data)}`,
      );
      throw new BadRequestException('فشل إنشاء جلسة الدفع');
    }

    return {
      checkoutId: data.id,
      entityId,
      paymentMethod: dto.paymentMethod,
      amount: dto.amount,
    };
  }

  /// الخطوة 2: الاستعلام عن حالة الدفع بعد إتمام العميل للدفع.
  async verifyPayment(
    checkoutId: string,
    method: CheckoutMethod,
  ): Promise<PaymentResult> {
    this.assertConfigured();
    const entityId = this.entityFor(method);

    const data = await this.request(
      `${this.baseUrl}/v1/checkouts/${encodeURIComponent(
        checkoutId,
      )}/payment?entityId=${encodeURIComponent(entityId)}`,
      { method: 'GET' },
    );

    return this.mapResult(data);
  }

  /// فكّ تشفير إشعار Webhook من HyperPay (AES-256-GCM).
  ///
  /// الجسم نص hex مشفّر، والترويستان X-Initialization-Vector و X-Authentication-Tag
  /// (hex). يرمي خطأً عند غياب السرّ أو فشل التحقق — فلا نثق بأي حمولة غير موقّعة.
  decryptWebhook(
    bodyHex: string,
    ivHex: string | undefined,
    tagHex: string | undefined,
  ): Record<string, any> {
    if (!this.webhookSecret) {
      throw new Error('HYPERPAY_WEBHOOK_SECRET غير مضبوط');
    }
    if (!bodyHex || !ivHex || !tagHex) {
      throw new Error('حمولة Webhook ناقصة (body/iv/tag)');
    }
    const decipher = createDecipheriv(
      'aes-256-gcm',
      Buffer.from(this.webhookSecret, 'hex'),
      Buffer.from(ivHex, 'hex'),
    );
    decipher.setAuthTag(Buffer.from(tagHex, 'hex'));
    const plain = Buffer.concat([
      decipher.update(Buffer.from(bodyHex.trim(), 'hex')),
      decipher.final(), // يرمي إن لم تطابق علامة المصادقة (حمولة مزوّرة/معدّلة)
    ]).toString('utf8');
    return JSON.parse(plain) as Record<string, any>;
  }

  /// تحويل استجابة HyperPay الخام إلى نتيجة موحّدة.
  mapResult(data: Record<string, any>): PaymentResult {
    const code: string = data.result?.code ?? '';
    return {
      success: SUCCESS_CODES.test(code),
      pending: PENDING_CODES.test(code),
      transactionId: data.id,
      amount: data.amount ? parseFloat(data.amount) : undefined,
      currency: data.currency,
      paymentBrand: data.paymentBrand,
      resultCode: code,
      resultDescription: data.result?.description,
    };
  }

  /// طلب HTTP موحّد مع ترويسة المصادقة ومعالجة الأخطاء.
  private async request(
    url: string,
    init: { method: string; body?: string },
  ): Promise<Record<string, any>> {
    let res: Response;
    try {
      res = await fetch(url, {
        method: init.method,
        headers: {
          Authorization: `Bearer ${this.accessToken}`,
          ...(init.body
            ? { 'Content-Type': 'application/x-www-form-urlencoded' }
            : {}),
        },
        body: init.body,
      });
    } catch (err) {
      this.logger.error(`تعذّر الوصول إلى HyperPay: ${(err as Error).message}`);
      throw new ServiceUnavailableException('تعذّر الاتصال ببوّابة الدفع');
    }

    const text = await res.text();
    let data: Record<string, any> = {};
    try {
      data = text ? JSON.parse(text) : {};
    } catch {
      this.logger.error(`استجابة HyperPay غير صالحة: ${text.slice(0, 200)}`);
      throw new ServiceUnavailableException('استجابة غير متوقّعة من بوّابة الدفع');
    }
    return data;
  }
}
