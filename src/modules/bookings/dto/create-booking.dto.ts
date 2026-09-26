import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsEnum,
  IsNumber,
  IsOptional,
  IsUUID,
  Max,
  Min,
} from 'class-validator';

const PAYMENT_METHODS = ['apple_pay', 'mada', 'card', 'wallet'];

export class CreateBookingDto {
  @ApiProperty({ description: 'معرّف المزوّد' })
  @IsUUID('4', { message: 'معرّف المزوّد غير صالح' })
  vendorId: string;

  @ApiPropertyOptional({ description: 'معرّف جلسة المزاج (اختياري)' })
  @IsOptional()
  @IsUUID('4', { message: 'معرّف جلسة المزاج غير صالح' })
  moodSessionId?: string;

  @ApiProperty({ enum: PAYMENT_METHODS, example: 'mada' })
  @IsEnum(PAYMENT_METHODS, { message: 'طريقة دفع غير صالحة' })
  paymentMethod: string;

  @ApiProperty({ example: 150 })
  @Type(() => Number)
  @IsNumber({}, { message: 'المبلغ يجب أن يكون رقماً' })
  @Min(0)
  amount: number;

  @ApiPropertyOptional({ example: 15, description: 'نسبة الخصم %' })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  @Max(100)
  discountPct?: number;
}
