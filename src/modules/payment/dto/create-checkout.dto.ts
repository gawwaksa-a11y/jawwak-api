import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsEmail,
  IsEnum,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Min,
} from 'class-validator';

/// طرق الدفع التي تمرّ عبر HyperPay (المحفظة لا تحتاج بوّابة).
export const CHECKOUT_METHODS = ['mada', 'card', 'apple_pay'] as const;
export type CheckoutMethod = (typeof CHECKOUT_METHODS)[number];

export class CreateCheckoutDto {
  @ApiProperty({ description: 'معرّف الحجز (pending) المراد دفعه' })
  @IsUUID('4', { message: 'معرّف الحجز غير صالح' })
  bookingId: string;

  @ApiProperty({ example: 'مطعم النخيل', description: 'اسم المكان (للوصف)' })
  @IsString()
  vendorName: string;

  // يُتجاهل: الخادم يحسب المبلغ من الحجز نفسه (لا يُوثق بمبلغ العميل).
  @ApiPropertyOptional({ description: 'مُتجاهَل — المبلغ يُحسب من الحجز' })
  @IsOptional()
  @Type(() => Number)
  @IsNumber({}, { message: 'المبلغ يجب أن يكون رقماً' })
  @Min(0)
  amount?: number;

  @ApiProperty({ enum: CHECKOUT_METHODS, example: 'mada' })
  @IsEnum(CHECKOUT_METHODS, { message: 'طريقة دفع غير مدعومة' })
  paymentMethod: CheckoutMethod;

  @ApiPropertyOptional({ example: 'customer@jawwak.app' })
  @IsOptional()
  @IsEmail({}, { message: 'بريد إلكتروني غير صالح' })
  customerEmail?: string;
}
