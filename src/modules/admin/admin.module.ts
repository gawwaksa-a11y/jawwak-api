import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { Booking } from '../bookings/entities/booking.entity';
import { MoodSession } from '../mood/entities/mood-session.entity';
import { UserReview } from '../reviews/entities/user-review.entity';
import { User } from '../users/entities/user.entity';
import { Vendor } from '../vendors/entities/vendor.entity';
import { AdminController } from './admin.controller';
import { AdminService } from './admin.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([Vendor, User, MoodSession, Booking, UserReview]),
  ],
  controllers: [AdminController],
  providers: [AdminService],
})
export class AdminModule {}
