import { Body, Controller, Get, Param, ParseUUIDPipe, Patch, Post } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';

import {
  AuthUser,
  CurrentUser,
} from '../../common/decorators/current-user.decorator';
import { MoodRequestDto } from './dto/mood-request.dto';
import { MoodService } from './mood.service';

@ApiTags('mood')
@ApiBearerAuth()
@Controller('mood')
export class MoodController {
  constructor(private readonly moodService: MoodService) {}

  @Post('recommend')
  // حد أشد على هذا المسار (20 طلب/دقيقة) لأنه مكلف حسابياً.
  @Throttle({ default: { limit: 20, ttl: 60_000 } })
  @ApiOperation({ summary: 'إرسال بيانات المزاج والحصول على 3 توصيات' })
  recommend(@Body() dto: MoodRequestDto, @CurrentUser() user: AuthUser) {
    return this.moodService.recommend(dto, user.id);
  }

  @Get('history')
  @ApiOperation({ summary: 'سجل جلسات المزاج للمستخدم' })
  history(@CurrentUser() user: AuthUser) {
    return this.moodService.history(user.id);
  }

  @Patch(':sessionId/select')
  @ApiOperation({ summary: 'تسجيل المزوّد الذي اختاره المستخدم' })
  select(
    @Param('sessionId', ParseUUIDPipe) sessionId: string,
    @Body('vendorId', ParseUUIDPipe) vendorId: string,
    @CurrentUser() user: AuthUser,
  ) {
    return this.moodService.selectVendor(sessionId, vendorId, user.id);
  }
}
