import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsOptional } from 'class-validator';

import { PaginationDto } from '../../../common/dto/pagination.dto';

const CATEGORIES = ['restaurant', 'cafe', 'activity', 'food_truck', 'event'];
const PRICE_RANGES = ['budget', 'mid', 'premium'];

/// معاملات قائمة المزوّدين: ترقيم + فلاتر.
export class VendorQueryDto extends PaginationDto {
  @ApiPropertyOptional({ enum: CATEGORIES })
  @IsOptional()
  @IsEnum(CATEGORIES, { message: 'تصنيف غير صالح' })
  category?: string;

  @ApiPropertyOptional({ enum: PRICE_RANGES })
  @IsOptional()
  @IsEnum(PRICE_RANGES, { message: 'فئة سعرية غير صالحة' })
  priceRange?: string;
}
