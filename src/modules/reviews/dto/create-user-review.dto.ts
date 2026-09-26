import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
} from 'class-validator';

const rating = (label: string) => [
  Type(() => Number),
  IsNumber({}, { message: `${label} يجب أن يكون رقماً` }),
  Min(1, { message: `${label}: أقل قيمة 1` }),
  Max(5, { message: `${label}: أعلى قيمة 5` }),
];

function Rating(label: string): PropertyDecorator {
  return (target, key) => rating(label).forEach((d) => d(target, key));
}

export class CreateUserReviewDto {
  @ApiProperty({ description: 'معرّف المكان' })
  @IsUUID('4', { message: 'معرّف المكان غير صالح' })
  vendorId: string;

  @ApiPropertyOptional({
    description: 'الحجز المُستخدم (إن غاب نختار آخر زيارة غير مُقيّمة)',
  })
  @IsOptional()
  @IsUUID('4', { message: 'معرّف الحجز غير صالح' })
  bookingId?: string;

  @ApiProperty({ example: 5 })
  @Rating('التقييم العام')
  overallRating: number;

  @ApiPropertyOptional() @IsOptional() @Rating('تقييم الطعام')
  foodRating?: number;

  @ApiPropertyOptional() @IsOptional() @Rating('تقييم الخدمة')
  serviceRating?: number;

  @ApiPropertyOptional() @IsOptional() @Rating('تقييم الأجواء')
  ambienceRating?: number;

  @ApiPropertyOptional() @IsOptional() @Rating('تقييم القيمة')
  valueRating?: number;

  @ApiPropertyOptional() @IsOptional() @Rating('تقييم التجربة')
  experienceRating?: number;

  @ApiPropertyOptional({ example: 'تجربة رائعة والخدمة سريعة' })
  @IsOptional()
  @IsString()
  @MaxLength(500, { message: 'النص لا يتجاوز 500 حرف' })
  reviewText?: string;

  @ApiPropertyOptional({ type: [String] })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(3, { message: 'حتى 3 صور' })
  @IsString({ each: true })
  images?: string[];

  @ApiPropertyOptional({ type: [String], example: ['خدمة سريعة'] })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(9)
  @IsString({ each: true })
  tags?: string[];
}
