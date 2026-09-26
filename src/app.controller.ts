import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { Controller, Get, Inject } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { Cache } from 'cache-manager';
import { DataSource } from 'typeorm';

import { Public } from './common/decorators/public.decorator';

@ApiTags('root')
@Controller()
export class AppController {
  constructor(
    private readonly dataSource: DataSource,
    @Inject(CACHE_MANAGER) private readonly cache: Cache,
    private readonly config: ConfigService,
  ) {}

  /// رسالة ترحيب على المسار الجذر مع روابط المسارات وحالة الصحة.
  @Public()
  @Get()
  @ApiOperation({ summary: 'رسالة ترحيب + روابط المسارات + حالة الصحة' })
  async welcome(): Promise<Record<string, unknown>> {
    const prefix = this.config.get<string>('API_PREFIX', 'api/v1');
    const base = `/${prefix}`;

    const [db, cache] = await Promise.all([
      this.checkDb(),
      this.checkCache(),
    ]);

    return {
      name: 'Jawwak API - جوّك',
      message: 'مرحباً بك في واجهة برمجة تطبيق جوّك 🧭',
      version: '1.0.0',
      status: db === 'up' ? 'ok' : 'degraded',
      health: {
        db,
        cache,
        driver: this.config.get<string>('DB_DRIVER') || 'auto',
        uptime: Math.round(process.uptime()),
      },
      docs: '/api/docs',
      endpoints: {
        health: `${base}/health`,
        auth: `${base}/auth/verify-token`,
        users: `${base}/users/me`,
        vendors: `${base}/vendors`,
        vendorsMine: `${base}/vendors/mine`,
        vendorsNearby: `${base}/vendors/nearby`,
        vendorBookings: `${base}/vendors/:id/bookings`,
        vendorFinance: `${base}/vendors/:id/finance`,
        vendorOffers: `${base}/vendors/:id/offers`,
        moodRecommend: `${base}/mood/recommend`,
        bookings: `${base}/bookings`,
        reviews: `${base}/reviews`,
        rewards: `${base}/rewards/me`,
        offers: `${base}/offers`,
      },
      timestamp: new Date().toISOString(),
    };
  }

  private async checkDb(): Promise<'up' | 'down'> {
    try {
      await this.dataSource.query('SELECT 1');
      return 'up';
    } catch {
      return 'down';
    }
  }

  private async checkCache(): Promise<'up' | 'down'> {
    try {
      await this.cache.set('root:ping', '1', 5000);
      return (await this.cache.get<string>('root:ping')) === '1'
          ? 'up'
          : 'down';
    } catch {
      return 'down';
    }
  }
}
