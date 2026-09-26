import { applyDecorators } from '@nestjs/common';
import { ApiQuery } from '@nestjs/swagger';

/// ديكوريتر Swagger لتوثيق معاملات الترقيم (pagination) على الـ endpoint.
export function ApiPagination() {
  return applyDecorators(
    ApiQuery({
      name: 'page',
      required: false,
      type: Number,
      description: 'رقم الصفحة (يبدأ من 1)',
      example: 1,
    }),
    ApiQuery({
      name: 'limit',
      required: false,
      type: Number,
      description: 'عدد العناصر في الصفحة (1-100)',
      example: 20,
    }),
  );
}
