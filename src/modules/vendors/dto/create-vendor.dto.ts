import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  ArrayNotEmpty,
  IsArray,
  IsEnum,
  IsLatitude,
  IsLongitude,
  IsOptional,
  IsString,
  Length,
} from 'class-validator';

const CATEGORIES = ['restaurant', 'cafe', 'activity', 'food_truck', 'event'];
const PRICE_RANGES = ['budget', 'mid', 'premium'];

export class CreateVendorDto {
  @ApiProperty({ example: 'مقهى نبت' })
  @IsString()
  @Length(2, 200)
  businessNameAr: string;

  @ApiProperty({ example: 'Nabt Cafe' })
  @IsString()
  @Length(2, 200)
  businessNameEn: string;

  @ApiProperty({ enum: CATEGORIES, example: 'cafe' })
  @IsEnum(CATEGORIES, { message: 'تصنيف غير صالح' })
  category: string;

  @ApiProperty({ example: 24.7136, description: 'خط العرض' })
  @IsLatitude({ message: 'خط العرض غير صالح' })
  lat: number;

  @ApiProperty({ example: 46.6753, description: 'خط الطول' })
  @IsLongitude({ message: 'خط الطول غير صالح' })
  lng: number;

  @ApiProperty({ example: 'حي الملقا، الرياض' })
  @IsString()
  addressText: string;

  @ApiProperty({ enum: PRICE_RANGES, example: 'mid' })
  @IsEnum(PRICE_RANGES, { message: 'فئة سعرية غير صالحة' })
  priceRange: string;

  @ApiProperty({ example: ['calm', 'explore'], type: [String] })
  @IsArray()
  @ArrayNotEmpty({ message: 'يجب تحديد وسم مزاج واحد على الأقل' })
  @IsString({ each: true })
  moodTags: string[];

  @ApiProperty({ example: ['solo', 'duo'], type: [String] })
  @IsArray()
  @ArrayNotEmpty({ message: 'يجب تحديد وسم رفقة واحد على الأقل' })
  @IsString({ each: true })
  companionTags: string[];

  @ApiPropertyOptional({ example: { daily: '07:00-24:00' } })
  @IsOptional()
  operatingHours?: Record<string, unknown>;

  @ApiPropertyOptional({ type: [String] })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  images?: string[];

  @ApiPropertyOptional({ example: '1010101010' })
  @IsOptional()
  @IsString()
  crNumber?: string;
}
