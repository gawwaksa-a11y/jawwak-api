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
import {
  ApiBearerAuth,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';

import { ApiPagination } from '../../common/decorators/api-pagination.decorator';
import {
  AuthUser,
  CurrentUser,
} from '../../common/decorators/current-user.decorator';
import { Public } from '../../common/decorators/public.decorator';
import { CreateVendorDto } from './dto/create-vendor.dto';
import { NearbyQueryDto } from './dto/nearby-query.dto';
import { UpdateVendorDto } from './dto/update-vendor.dto';
import { VendorBookingsQueryDto } from './dto/vendor-bookings-query.dto';
import { VendorQueryDto } from './dto/vendor-query.dto';
import { VendorsService } from './vendors.service';

@ApiTags('vendors')
@Controller('vendors')
export class VendorsController {
  constructor(private readonly vendorsService: VendorsService) {}

  @Public()
  @Get()
  @ApiPagination()
  @ApiOperation({ summary: 'قائمة المزوّدين مع ترقيم وفلاتر' })
  findAll(@Query() query: VendorQueryDto) {
    return this.vendorsService.findAll(query, {
      category: query.category,
      priceRange: query.priceRange,
    });
  }

  // ملاحظة: هذا المسار قبل :id حتى لا يبتلعه معامل المسار.
  @Public()
  @Get('nearby')
  @ApiOperation({ summary: 'مزوّدون قريبون (lat, lng, radius_km, category)' })
  nearby(@Query() query: NearbyQueryDto) {
    return this.vendorsService.nearby(query);
  }

  // متجري — قبل :id حتى لا يبتلعه معامل المسار.
  @Get('mine')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'متجر المزوّد الحالي (حسب التوكن)' })
  mine(@CurrentUser() user: AuthUser) {
    return this.vendorsService.getMine(user);
  }

  @Public()
  @Get(':id')
  @ApiOperation({ summary: 'تفاصيل مزوّد واحد' })
  findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.vendorsService.findOne(id);
  }

  @Get(':id/stats')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'إحصائيات المزوّد (مشاهدات، حجوزات، معدّل التحويل)' })
  async stats(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: AuthUser,
  ) {
    await this.vendorsService.assertOwner(id, user);
    return this.vendorsService.stats(id);
  }

  @Get(':id/bookings')
  @ApiBearerAuth()
  @ApiPagination()
  @ApiOperation({ summary: 'حجوزات المزوّد (فلترة بالحالة والتاريخ + ترقيم)' })
  async bookings(
    @Param('id', ParseUUIDPipe) id: string,
    @Query() query: VendorBookingsQueryDto,
    @CurrentUser() user: AuthUser,
  ) {
    await this.vendorsService.assertOwner(id, user);
    return this.vendorsService.getBookings(id, query);
  }

  @Get(':id/finance')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'التقرير المالي للمزوّد (إيرادات، عمولة، صافي)' })
  async finance(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: AuthUser,
  ) {
    await this.vendorsService.assertOwner(id, user);
    return this.vendorsService.getFinance(id);
  }

  @Post()
  @ApiBearerAuth()
  @ApiOperation({ summary: 'تسجيل مزوّد جديد (self-onboarding)' })
  create(@Body() dto: CreateVendorDto, @CurrentUser() user: AuthUser) {
    return this.vendorsService.create(dto, user.id);
  }

  @Patch(':id')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'تحديث بيانات المزوّد (المالك فقط)' })
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateVendorDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.vendorsService.update(id, dto, user);
  }
}
