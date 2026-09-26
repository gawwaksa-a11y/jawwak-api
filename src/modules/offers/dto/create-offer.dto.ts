import { ApiProperty } from '@nestjs/swagger';
import {
  IsDateString,
  IsInt,
  IsString,
  IsUUID,
  Length,
  Max,
  Min,
} from 'class-validator';
import { Type } from 'class-transformer';

export class CreateOfferDto {
  @ApiProperty({ description: 'معرّف المزوّد' })
  @IsUUID('4', { message: 'معرّف المزوّد غير صالح' })
  vendorId: string;

  @ApiProperty({ example: 'خصم الافتتاح' })
  @IsString()
  @Length(2, 120, { message: 'اسم العرض يجب أن يكون بين 2 و 120 حرف' })
  title: string;

  @ApiProperty({ example: 15, description: 'نسبة الخصم % (5-50)' })
  @Type(() => Number)
  @IsInt({ message: 'نسبة الخصم يجب أن تكون رقماً صحيحاً' })
  @Min(5, { message: 'أقل خصم 5%' })
  @Max(50, { message: 'أعلى خصم 50%' })
  discountPct: number;

  @ApiProperty({ example: '2026-01-01' })
  @IsDateString({}, { message: 'تاريخ البداية غير صالح' })
  startDate: string;

  @ApiProperty({ example: '2026-01-31' })
  @IsDateString({}, { message: 'تاريخ النهاية غير صالح' })
  endDate: string;
}
