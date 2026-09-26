import { Body, Controller, Delete, Get, Patch } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';

import {
  AuthUser,
  CurrentUser,
} from '../../common/decorators/current-user.decorator';
import { UpdateUserDto } from './dto/update-user.dto';
import { UsersService } from './users.service';

@ApiTags('users')
@ApiBearerAuth()
@Controller('users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Get('me')
  @ApiOperation({ summary: 'بيانات المستخدم الحالي' })
  @ApiOkResponse({ description: 'ملف المستخدم' })
  getMe(@CurrentUser() user: AuthUser) {
    return this.usersService.getMe(user);
  }

  @Patch('me')
  @ApiOperation({ summary: 'تحديث الاسم/الصورة/اللغة/رمز الجهاز' })
  updateMe(@CurrentUser() user: AuthUser, @Body() dto: UpdateUserDto) {
    return this.usersService.updateMe(user, dto);
  }

  @Delete('me')
  @ApiOperation({ summary: 'حذف الحساب (PDPL) — حذف ناعم ثم نهائي بعد 30 يوماً' })
  deleteMe(@CurrentUser() user: AuthUser) {
    return this.usersService.softDeleteMe(user);
  }

  @Get('me/data-export')
  @ApiOperation({ summary: 'تصدير جميع بيانات المستخدم (PDPL)' })
  exportData(@CurrentUser() user: AuthUser) {
    return this.usersService.exportData(user);
  }
}
