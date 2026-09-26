import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsEnum,
  IsLatitude,
  IsLongitude,
  IsOptional,
  Max,
  Min,
} from 'class-validator';

const CATEGORIES = ['restaurant', 'cafe', 'activity', 'food_truck', 'event'];

export class NearbyQueryDto {
  @ApiProperty({ example: 24.7136 })
  @Type(() => Number)
  @IsLatitude({ message: 'خط العرض غير صالح' })
  lat: number;

  @ApiProperty({ example: 46.6753 })
  @Type(() => Number)
  @IsLongitude({ message: 'خط الطول غير صالح' })
  lng: number;

  @ApiPropertyOptional({ example: 10, description: 'نصف القطر بالكيلومتر' })
  @IsOptional()
  @Type(() => Number)
  @Min(0.1)
  @Max(50)
  radiusKm: number = 10;

  @ApiPropertyOptional({ enum: CATEGORIES })
  @IsOptional()
  @IsEnum(CATEGORIES, { message: 'تصنيف غير صالح' })
  category?: string;
}
