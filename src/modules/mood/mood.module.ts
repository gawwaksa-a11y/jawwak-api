import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { VendorsModule } from '../vendors/vendors.module';
import { MoodSession } from './entities/mood-session.entity';
import { MoodController } from './mood.controller';
import { MoodService } from './mood.service';

@Module({
  imports: [TypeOrmModule.forFeature([MoodSession]), VendorsModule],
  controllers: [MoodController],
  providers: [MoodService],
  exports: [MoodService],
})
export class MoodModule {}
