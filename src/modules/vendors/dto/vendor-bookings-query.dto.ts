import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsDateString, IsIn, IsOptional } from 'class-validator';

import { PaginationDto } from '../../../common/dto/pagination.dto';

const STATUSES = ['pending', 'confirmed', 'used', 'cancelled', 'expired'];

/// معاملات قائمة حجوزات المزوّد: ترقيم + فلتر بالحالة والتاريخ.
export class VendorBookingsQueryDto extends PaginationDto {
  @ApiPropertyOptional({ enum: STATUSES })
  @IsOptional()
  @IsIn(STATUSES, { message: 'حالة غير صالحة' })
  status?: string;

  @ApiPropertyOptional({ example: '2026-01-01', description: 'من تاريخ' })
  @IsOptional()
  @IsDateString({}, { message: 'تاريخ البداية غير صالح' })
  from?: string;

  @ApiPropertyOptional({ example: '2026-01-31', description: 'إلى تاريخ' })
  @IsOptional()
  @IsDateString({}, { message: 'تاريخ النهاية غير صالح' })
  to?: string;
}
