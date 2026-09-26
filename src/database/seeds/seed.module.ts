import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { Booking } from '../../modules/bookings/entities/booking.entity';
import { Offer } from '../../modules/offers/entities/offer.entity';
import { JawwakReview } from '../../modules/reviews/entities/jawwak-review.entity';
import { UserReview } from '../../modules/reviews/entities/user-review.entity';
import { ReviewsModule } from '../../modules/reviews/reviews.module';
import { User } from '../../modules/users/entities/user.entity';
import { Vendor } from '../../modules/vendors/entities/vendor.entity';
import { SeederService } from './seeder.service';

/// وحدة الزرع التلقائي عند الإقلاع (تطوير فقط).
@Module({
  imports: [
    TypeOrmModule.forFeature([Vendor, Booking, Offer, UserReview, JawwakReview, User]),
    ReviewsModule,
  ],
  providers: [SeederService],
})
export class SeedModule {}
