import { CacheModule } from '@nestjs/cache-manager';
import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { APP_FILTER, APP_GUARD, APP_INTERCEPTOR } from '@nestjs/core';
import { ScheduleModule } from '@nestjs/schedule';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { TypeOrmModule } from '@nestjs/typeorm';

import { AppController } from './app.controller';
import { buildTypeOrmOptions } from './config/database.config';
import { envValidationSchema } from './config/env.validation';
import { FirebaseModule } from './config/firebase.module';
import { redisCacheOptions } from './config/redis.config';
import { SeedModule } from './database/seeds/seed.module';
import { FirebaseAuthGuard } from './common/guards/firebase-auth.guard';
import { HttpExceptionFilter } from './common/filters/http-exception.filter';
import { LoggingInterceptor } from './common/interceptors/logging.interceptor';
import { TransformInterceptor } from './common/interceptors/transform.interceptor';
import { HealthModule } from './health/health.module';
import { AuthModule } from './modules/auth/auth.module';
import { BookingsModule } from './modules/bookings/bookings.module';
import { AdminModule } from './modules/admin/admin.module';
import { MoodModule } from './modules/mood/mood.module';
import { NotificationsModule } from './modules/notifications/notifications.module';
import { OffersModule } from './modules/offers/offers.module';
import { PaymentModule } from './modules/payment/payment.module';
import { ReviewsModule } from './modules/reviews/reviews.module';
import { RewardsModule } from './modules/rewards/rewards.module';
import { UsersModule } from './modules/users/users.module';
import { VendorsModule } from './modules/vendors/vendors.module';

@Module({
  imports: [
    // إعدادات البيئة مع التحقق عبر Joi.
    ConfigModule.forRoot({
      isGlobal: true,
      validationSchema: envValidationSchema,
    }),

    // قاعدة البيانات (PostgreSQL + PostGIS).
    TypeOrmModule.forRootAsync({
      inject: [ConfigService],
      useFactory: buildTypeOrmOptions,
    }),

    // الكاش (Redis).
    CacheModule.registerAsync(redisCacheOptions),

    // الحد من المعدّل (Rate limiting) — 100 طلب/دقيقة افتراضياً.
    ThrottlerModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        throttlers: [
          {
            ttl: config.get<number>('THROTTLE_TTL', 60) * 1000,
            limit: config.get<number>('THROTTLE_LIMIT', 100),
          },
        ],
      }),
    }),

    // المهام المجدولة (انتهاء صلاحية الحجوزات).
    ScheduleModule.forRoot(),

    // Firebase (عام).
    FirebaseModule,

    // وحدات الميزات.
    AuthModule,
    UsersModule,
    VendorsModule,
    MoodModule,
    BookingsModule,
    ReviewsModule,
    RewardsModule,
    OffersModule,
    PaymentModule,
    AdminModule,
    NotificationsModule,
    HealthModule,

    // الزرع التلقائي عند الإقلاع (تطوير فقط).
    SeedModule,
  ],
  controllers: [AppController],
  providers: [
    // الحراس العامة: الحد من المعدّل ثم مصادقة Firebase.
    { provide: APP_GUARD, useClass: ThrottlerGuard },
    { provide: APP_GUARD, useClass: FirebaseAuthGuard },
    // الاعتراضات العامة.
    { provide: APP_INTERCEPTOR, useClass: LoggingInterceptor },
    { provide: APP_INTERCEPTOR, useClass: TransformInterceptor },
    // فلتر الأخطاء الموحّد.
    { provide: APP_FILTER, useClass: HttpExceptionFilter },
  ],
})
export class AppModule {}
