import 'dotenv/config';
import { DataSource, DataSourceOptions } from 'typeorm';

import { currentDriver } from '../config/db-driver';
import { migrationsGlob, pgConnection } from '../config/pg-connection';
import { Booking } from '../modules/bookings/entities/booking.entity';
import { MoodSession } from '../modules/mood/entities/mood-session.entity';
import { Offer } from '../modules/offers/entities/offer.entity';
import { PointsLedger } from '../modules/rewards/entities/points-ledger.entity';
import { JawwakReview } from '../modules/reviews/entities/jawwak-review.entity';
import { ReviewHelpfulVote } from '../modules/reviews/entities/review-helpful-vote.entity';
import { UserReview } from '../modules/reviews/entities/user-review.entity';
import { User } from '../modules/users/entities/user.entity';
import { Vendor } from '../modules/vendors/entities/vendor.entity';

const entities = [
  User,
  Vendor,
  MoodSession,
  Booking,
  UserReview,
  JawwakReview,
  ReviewHelpfulVote,
  PointsLedger,
  Offer,
];

/// خيارات مصدر البيانات المستقل (CLI: seed/migrations) حسب السائق.
function buildOptions(): DataSourceOptions {
  if (currentDriver() === 'sqlite') {
    return {
      type: 'sqljs',
      autoSave: true,
      location: process.env.SQLITE_PATH ?? 'jawwak-dev.sqlite',
      entities,
      synchronize: true, // ينشئ المخطط تلقائياً قبل الزرع
      logging: ['error'],
    };
  }
  // Postgres: المخطط يُدار بالـ migrations فقط (لا synchronize أبداً من CLI).
  return {
    type: 'postgres',
    ...pgConnection(),
    uuidExtension: 'pgcrypto',
    entities,
    migrations: [migrationsGlob],
    synchronize: false,
    logging: ['error', 'migration'],
  };
}

export const AppDataSource = new DataSource(buildOptions());
