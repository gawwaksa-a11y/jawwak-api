import { Body, Controller, Post } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';

import { Public } from '../../common/decorators/public.decorator';
import { AuthService } from './auth.service';
import { VerifyTokenDto } from './dto/verify-token.dto';

@ApiTags('auth')
@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Public()
  @Post('verify-token')
  @ApiOperation({
    summary: 'التحقق من Firebase ID token وإنشاء/تحديث المستخدم',
  })
  verifyToken(@Body() dto: VerifyTokenDto) {
    return this.authService.verifyToken(dto);
  }
}
