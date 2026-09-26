import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsInt, IsOptional, IsString, Min } from 'class-validator';

export class RedeemDto {
  @ApiProperty({ example: 80, description: 'عدد النقاط المراد استبدالها' })
  @Type(() => Number)
  @IsInt({ message: 'النقاط يجب أن تكون رقماً صحيحاً' })
  @Min(1, { message: 'أقل عدد للاستبدال هو 1' })
  points: number;

  @ApiPropertyOptional({ example: 'خصم 25%' })
  @IsOptional()
  @IsString()
  rewardTitle?: string;
}
