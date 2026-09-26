import { ApiProperty, ApiPropertyOptional, PartialType } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsBoolean,
  IsDateString,
  IsIn,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
} from 'class-validator';

import { JAWWAK_BADGES } from '../review.constants';

function Score(max: number): PropertyDecorator {
  return (target, key) => {
    Type(() => Number)(target, key);
    IsNumber()(target, key);
    Min(0)(target, key);
    Max(max, { message: `القيمة القصوى ${max}` })(target, key);
  };
}

export class CreateJawwakReviewDto {
  @ApiProperty() @IsUUID('4', { message: 'معرّف المكان غير صالح' })
  vendorId: string;

  @ApiProperty({ example: 'فريق جوّك' })
  @IsString()
  @MaxLength(100)
  reviewerName: string;

  @ApiProperty({ example: '2026-09-20' })
  @IsDateString({}, { message: 'تاريخ الزيارة غير صالح' })
  visitDate: string;

  @ApiProperty({ description: 'التقييم العام 0..5' }) @Score(5)
  overallScore: number;

  @ApiProperty({ description: '0..10' }) @Score(10) qualityScore: number;
  @ApiProperty({ description: '0..10' }) @Score(10) serviceScore: number;
  @ApiProperty({ description: '0..10' }) @Score(10) cleanlinessScore: number;
  @ApiProperty({ description: '0..10' }) @Score(10) valueScore: number;
  @ApiProperty({ description: '0..10' }) @Score(10) ambienceScore: number;

  @ApiProperty() @IsString() @MaxLength(300) summary: string;
  @ApiProperty() @IsString() detailedReview: string;

  @ApiPropertyOptional() @IsOptional() @IsString() prosTips?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() consTips?: string;

  @ApiPropertyOptional({ type: [String], enum: JAWWAK_BADGES })
  @IsOptional()
  @IsArray()
  @IsIn(JAWWAK_BADGES, { each: true, message: 'شارة غير معتمدة' })
  badges?: string[];

  @ApiPropertyOptional({ type: [String] })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(10)
  @IsString({ each: true })
  images?: string[];

  @ApiPropertyOptional({ default: true })
  @IsOptional()
  @IsBoolean()
  isPublished?: boolean;
}

/// التحديث عبر vendorId في المسار — كل الحقول اختيارية.
export class UpdateJawwakReviewDto extends PartialType(CreateJawwakReviewDto) {}
