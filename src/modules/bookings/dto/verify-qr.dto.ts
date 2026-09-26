import { ApiProperty } from '@nestjs/swagger';
import { IsString, MinLength } from 'class-validator';

export class VerifyQrDto {
  @ApiProperty({ description: 'محتوى رمز QR المشفّر الممسوح' })
  @IsString()
  @MinLength(10, { message: 'رمز QR غير صالح' })
  qrCode: string;
}
