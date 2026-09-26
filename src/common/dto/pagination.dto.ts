import { Type } from 'class-transformer';
import { IsInt, IsOptional, Max, Min } from 'class-validator';

/// معاملات الترقيم المشتركة.
export class PaginationDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt({ message: 'رقم الصفحة يجب أن يكون رقماً صحيحاً' })
  @Min(1, { message: 'رقم الصفحة يجب أن يكون 1 على الأقل' })
  page: number = 1;

  @IsOptional()
  @Type(() => Number)
  @IsInt({ message: 'الحد يجب أن يكون رقماً صحيحاً' })
  @Min(1, { message: 'الحد يجب أن يكون 1 على الأقل' })
  @Max(100, { message: 'الحد الأقصى 100 عنصر في الصفحة' })
  limit: number = 20;

  get skip(): number {
    return (this.page - 1) * this.limit;
  }
}

/// شكل استجابة مُرقّمة موحّد.
export interface PaginatedResult<T> {
  items: T[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}
