import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { Booking } from '../bookings/entities/booking.entity';
import { RewardsModule } from '../rewards/rewards.module';
import { User } from '../users/entities/user.entity';
import { Vendor } from '../vendors/entities/vendor.entity';
import { JawwakReview } from './entities/jawwak-review.entity';
import { ReviewHelpfulVote } from './entities/review-helpful-vote.entity';
import { UserReview } from './entities/user-review.entity';
import { ReviewsController } from './reviews.controller';
import { ReviewsService } from './reviews.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      UserReview,
      JawwakReview,
      ReviewHelpfulVote,
      Booking,
      Vendor,
      User,
    ]),
    RewardsModule,
  ],
  controllers: [ReviewsController],
  providers: [ReviewsService],
  exports: [ReviewsService],
})
export class ReviewsModule {}
