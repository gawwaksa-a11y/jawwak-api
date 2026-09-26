import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsEnum,
  IsInt,
  IsLatitude,
  IsLongitude,
  Min,
} from 'class-validator';

const COMPANIONS = ['solo', 'duo', 'family', 'group'];
const MOODS = ['calm', 'excitement', 'explore', 'food'];
const TIME_SLOTS = ['morning', 'afternoon', 'evening', 'late_night'];

export class MoodRequestDto {
  @ApiProperty({ enum: COMPANIONS, example: 'duo' })
  @IsEnum(COMPANIONS, { message: 'نوع الرفقة غير صالح' })
  companion: string;

  @ApiProperty({ enum: MOODS, example: 'food' })
  @IsEnum(MOODS, { message: 'نوع المزاج غير صالح' })
  mood: string;

  @ApiProperty({ example: 50 })
  @Type(() => Number)
  @IsInt({ message: 'الحد الأدنى للميزانية يجب أن يكون رقماً صحيحاً' })
  @Min(0)
  budgetMin: number;

  @ApiProperty({ example: 200 })
  @Type(() => Number)
  @IsInt({ message: 'الحد الأعلى للميزانية يجب أن يكون رقماً صحيحاً' })
  @Min(0)
  budgetMax: number;

  @ApiProperty({ enum: TIME_SLOTS, example: 'evening' })
  @IsEnum(TIME_SLOTS, { message: 'الفترة الزمنية غير صالحة' })
  timeSlot: string;

  @ApiProperty({ example: 24.7136 })
  @Type(() => Number)
  @IsLatitude({ message: 'خط العرض غير صالح' })
  userLat: number;

  @ApiProperty({ example: 46.6753 })
  @Type(() => Number)
  @IsLongitude({ message: 'خط الطول غير صالح' })
  userLng: number;
}
