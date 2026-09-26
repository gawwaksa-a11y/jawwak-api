import { Body, Controller, Get, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';

import {
  AuthUser,
  CurrentUser,
} from '../../common/decorators/current-user.decorator';
import { RedeemDto } from './dto/redeem.dto';
import { RewardsService } from './rewards.service';

@ApiTags('rewards')
@ApiBearerAuth()
@Controller('rewards')
export class RewardsController {
  constructor(private readonly rewardsService: RewardsService) {}

  @Get('me')
  @ApiOperation({ summary: 'نقاطي + المستوى + السجل' })
  getMe(@CurrentUser() user: AuthUser) {
    return this.rewardsService.getSummary(user.id);
  }

  @Post('redeem')
  @ApiOperation({ summary: 'استبدال نقاط بخصم' })
  redeem(@CurrentUser() user: AuthUser, @Body() dto: RedeemDto) {
    return this.rewardsService.redeem(user.id, dto.points);
  }

  @Post('referral')
  @ApiOperation({ summary: 'إنشاء رابط إحالة' })
  referral(@CurrentUser() user: AuthUser) {
    return this.rewardsService.createReferral(user.id);
  }
}
