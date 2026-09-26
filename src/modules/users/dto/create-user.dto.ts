import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsOptional,
  IsString,
  Length,
  Matches,
  MaxLength,
} from 'class-validator';

export class CreateUserDto {
  @ApiProperty({ example: '+966500000000', description: 'رقم الجوال' })
  @IsString()
  @Matches(/^\+?[0-9]{9,15}$/, { message: 'رقم جوال غير صالح' })
  phone: string;

  @ApiProperty({ example: 'ضيف جوّك', description: 'الاسم المعروض' })
  @IsString()
  @Length(2, 100, { message: 'الاسم يجب أن يكون بين 2 و 100 حرف' })
  displayName: string;

  @ApiPropertyOptional({ example: 'ar', description: 'اللغة' })
  @IsOptional()
  @IsString()
  @MaxLength(5)
  locale?: string;

  @ApiPropertyOptional({ description: 'معرّف Firebase' })
  @IsOptional()
  @IsString()
  firebaseUid?: string;

  @ApiPropertyOptional({ description: 'رمز جهاز FCM' })
  @IsOptional()
  @IsString()
  deviceToken?: string;
}
