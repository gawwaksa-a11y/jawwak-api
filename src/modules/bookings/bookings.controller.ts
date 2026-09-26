import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiQuery, ApiTags } from '@nestjs/swagger';

import {
  AuthUser,
  CurrentUser,
} from '../../common/decorators/current-user.decorator';
import { BookingsService } from './bookings.service';
import { CreateBookingDto } from './dto/create-booking.dto';
import { VerifyQrDto } from './dto/verify-qr.dto';

@ApiTags('bookings')
@ApiBearerAuth()
@Controller('bookings')
export class BookingsController {
  constructor(private readonly bookingsService: BookingsService) {}

  @Post()
  @ApiOperation({ summary: 'إنشاء حجز جديد وتوليد تذكرة QR' })
  create(@Body() dto: CreateBookingDto, @CurrentUser() user: AuthUser) {
    return this.bookingsService.create(dto, user.id);
  }

  @Get()
  @ApiQuery({ name: 'status', required: false })
  @ApiOperation({ summary: 'حجوزاتي (مع فلتر الحالة)' })
  findMine(
    @CurrentUser() user: AuthUser,
    @Query('status') status?: string,
  ) {
    return this.bookingsService.findAllForUser(user.id, status);
  }

  @Get(':id')
  @ApiOperation({ summary: 'تفاصيل حجز واحد مع QR' })
  findOne(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: AuthUser,
  ) {
    return this.bookingsService.findOne(id, user.id);
  }

  @Post(':id/verify-qr')
  @ApiOperation({ summary: 'المزوّد يمسح QR ← تحديث الحالة إلى used' })
  verifyQr(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: VerifyQrDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.bookingsService.verifyQr(id, dto.qrCode, user);
  }

  @Patch(':id/cancel')
  @ApiOperation({ summary: 'إلغاء حجز (قبل الاستخدام فقط)' })
  cancel(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: AuthUser,
  ) {
    return this.bookingsService.cancel(id, user.id);
  }
}
