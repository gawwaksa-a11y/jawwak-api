import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, IsUrl, Length, MaxLength } from 'class-validator';

export class UpdateUserDto {
  @ApiPropertyOptional({ example: 'عمر السحيم' })
  @IsOptional()
  @IsString()
  @Length(2, 100, { message: 'الاسم يجب أن يكون بين 2 و 100 حرف' })
  displayName?: string;

  @ApiPropertyOptional({ example: 'https://cdn.jawwak.sa/avatar.png' })
  @IsOptional()
  @IsUrl({}, { message: 'رابط الصورة غير صالح' })
  avatarUrl?: string;

  @ApiPropertyOptional({ example: 'ar' })
  @IsOptional()
  @IsString()
  @MaxLength(5)
  locale?: string;

  @ApiPropertyOptional({ description: 'رمز جهاز FCM' })
  @IsOptional()
  @IsString()
  deviceToken?: string;
}
