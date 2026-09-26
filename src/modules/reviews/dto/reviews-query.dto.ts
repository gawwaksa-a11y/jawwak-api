import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsIn, IsNumber, IsOptional, Max, Min } from 'class-validator';

import { PaginationDto } from '../../../common/dto/pagination.dto';

export const REVIEW_SORTS = ['helpful', 'recent', 'highest', 'lowest'] as const;
export const REVIEW_ASPECT_FILTERS = [
  'food',
  'service',
  'ambience',
  'value',
  'experience',
] as const;

export class ReviewsQueryDto extends PaginationDto {
  @ApiPropertyOptional({ enum: REVIEW_SORTS, default: 'helpful' })
  @IsOptional()
  @IsIn(REVIEW_SORTS)
  sort: (typeof REVIEW_SORTS)[number] = 'helpful';

  /// تبويب المحور: يعرض التقييمات التي قيّمت هذا المحور، مرتّبة حسبه.
  @ApiPropertyOptional({ enum: REVIEW_ASPECT_FILTERS })
  @IsOptional()
  @IsIn(REVIEW_ASPECT_FILTERS)
  aspect?: (typeof REVIEW_ASPECT_FILTERS)[number];

  @ApiPropertyOptional({ minimum: 1, maximum: 5 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  @Max(5)
  minRating?: number;
}
