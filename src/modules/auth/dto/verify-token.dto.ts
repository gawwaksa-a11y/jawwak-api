import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString } from 'class-validator';

export class VerifyTokenDto {
  @ApiProperty({ description: 'Firebase ID token' })
  @IsString()
  idToken: string;

  @ApiPropertyOptional({ description: 'رمز جهاز FCM' })
  @IsOptional()
  @IsString()
  deviceToken?: string;
}
