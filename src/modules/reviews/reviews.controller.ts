import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiQuery,
  ApiTags,
} from '@nestjs/swagger';

import { ApiPagination } from '../../common/decorators/api-pagination.decorator';
import {
  AuthUser,
  CurrentUser,
} from '../../common/decorators/current-user.decorator';
import { Public } from '../../common/decorators/public.decorator';
import { PaginationDto } from '../../common/dto/pagination.dto';
import { AdminGuard } from '../../common/guards/admin.guard';
import { CreateUserReviewDto } from './dto/create-user-review.dto';
import {
  CreateJawwakReviewDto,
  UpdateJawwakReviewDto,
} from './dto/jawwak-review.dto';
import { ReviewsQueryDto } from './dto/reviews-query.dto';
import { ReviewsService } from './reviews.service';

@ApiTags('reviews')
@Controller()
export class ReviewsController {
  constructor(private readonly reviewsService: ReviewsService) {}

  // ---------- بيانات وصفية ----------

  @Public()
  @Get('reviews/meta')
  @ApiQuery({ name: 'category', required: true, example: 'restaurant' })
  @ApiOperation({ summary: 'محاور ووسوم التقييم حسب فئة المكان' })
  meta(@Query('category') category: string) {
    return this.reviewsService.meta(category);
  }

  // ---------- تقييمات المستخدمين ----------

  @Post('reviews')
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'إضافة تقييم مستخدم (زيارة موثّقة: حجز مُستخدم) — +5 نقاط',
  })
  create(@Body() dto: CreateUserReviewDto, @CurrentUser() user: AuthUser) {
    return this.reviewsService.createUserReview(dto, user.id);
  }

  @Public()
  @Get('reviews/vendor/:vendorId')
  @ApiPagination()
  @ApiOperation({ summary: 'تقييمات مكان (المستخدمون + تقييم جوّك الرسمي)' })
  vendorReviews(
    @Param('vendorId', ParseUUIDPipe) vendorId: string,
    @Query() query: ReviewsQueryDto,
  ) {
    return this.reviewsService.getVendorReviews(vendorId, query);
  }

  @Public()
  @Get('reviews/vendor/:vendorId/summary')
  @ApiOperation({ summary: 'ملخّص التقييمات: المتوسط + التوزيع + المحاور + جوّك' })
  summary(@Param('vendorId', ParseUUIDPipe) vendorId: string) {
    return this.reviewsService.getReviewsSummary(vendorId);
  }

  @Post('reviews/:id/helpful')
  @ApiBearerAuth()
  @ApiOperation({ summary: '"هذا التقييم مفيد" — صوت واحد لكل مستخدم' })
  helpful(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: AuthUser,
  ) {
    return this.reviewsService.markHelpful(id, user.id);
  }

  // ---------- تقييم فريق جوّك (مشرفون فقط) ----------

  @Post('reviews/jawwak')
  @ApiBearerAuth()
  @UseGuards(AdminGuard)
  @ApiOperation({ summary: 'إضافة تقييم جوّك الرسمي (مشرفون)' })
  createJawwak(@Body() dto: CreateJawwakReviewDto) {
    return this.reviewsService.createJawwakReview(dto);
  }

  @Patch('reviews/jawwak/:vendorId')
  @ApiBearerAuth()
  @UseGuards(AdminGuard)
  @ApiOperation({ summary: 'تحديث تقييم جوّك الرسمي (مشرفون)' })
  updateJawwak(
    @Param('vendorId', ParseUUIDPipe) vendorId: string,
    @Body() dto: UpdateJawwakReviewDto,
  ) {
    return this.reviewsService.updateJawwakReview(vendorId, dto);
  }

  // ---------- توافق خلفي (لوحة المزوّدين) ----------

  @Public()
  @Get('vendors/:id/reviews')
  @ApiPagination()
  @ApiOperation({ summary: '(قديم) تقييمات مزوّد مع ترقيم — rating/comment' })
  findForVendor(
    @Param('id', ParseUUIDPipe) id: string,
    @Query() pagination: PaginationDto,
  ) {
    return this.reviewsService.findForVendorLegacy(id, pagination);
  }
}
