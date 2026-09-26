import { ApiProperty } from '@nestjs/swagger';
import { IsEnum, IsString, IsUUID } from 'class-validator';

import { CHECKOUT_METHODS, CheckoutMethod } from './create-checkout.dto';

export class VerifyPaymentDto {
  @ApiProperty({ description: 'معرّف الـ checkout من HyperPay' })
  @IsString()
  checkoutId: string;

  @ApiProperty({ description: 'معرّف الحجز المرتبط' })
  @IsUUID('4', { message: 'معرّف الحجز غير صالح' })
  bookingId: string;

  @ApiProperty({ enum: CHECKOUT_METHODS, example: 'mada' })
  @IsEnum(CHECKOUT_METHODS, { message: 'طريقة دفع غير مدعومة' })
  paymentMethod: CheckoutMethod;
}
