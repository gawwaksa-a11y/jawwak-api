import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';

import {
  AuthUser,
  CurrentUser,
} from '../../common/decorators/current-user.decorator';
import { Public } from '../../common/decorators/public.decorator';
import { CreateOfferDto } from './dto/create-offer.dto';
import { UpdateOfferDto } from './dto/update-offer.dto';
import { OffersService } from './offers.service';

@ApiTags('offers')
@Controller()
export class OffersController {
  constructor(private readonly offersService: OffersService) {}

  @Post('offers')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'إنشاء عرض/خصم جديد' })
  create(@Body() dto: CreateOfferDto, @CurrentUser() user: AuthUser) {
    return this.offersService.create(dto, user);
  }

  @Public()
  @Get('vendors/:id/offers')
  @ApiOperation({ summary: 'قائمة عروض مزوّد' })
  findByVendor(@Param('id', ParseUUIDPipe) id: string) {
    return this.offersService.findByVendor(id);
  }

  @Patch('offers/:id')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'تحديث عرض (تفعيل/إيقاف أو تعديل)' })
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateOfferDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.offersService.update(id, dto, user);
  }

  @Delete('offers/:id')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'حذف عرض' })
  remove(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: AuthUser,
  ) {
    return this.offersService.remove(id, user);
  }
}
