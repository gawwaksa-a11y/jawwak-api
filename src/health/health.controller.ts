import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { Controller, Get, Inject } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { Cache } from 'cache-manager';
import { DataSource } from 'typeorm';

import { Public } from '../common/decorators/public.decorator';

@ApiTags('health')
@Controller('health')
export class HealthController {
  constructor(
    private readonly dataSource: DataSource,
    @Inject(CACHE_MANAGER) private readonly cache: Cache,
  ) {}

  @Public()
  @Get()
  @ApiOperation({ summary: 'فحص صحّة الخدمة (قاعدة البيانات + Redis)' })
  async check(): Promise<Record<string, unknown>> {
    const db = await this.checkDb();
    const redis = await this.checkRedis();
    const ok = db === 'up' && redis === 'up';
    return {
      status: ok ? 'ok' : 'degraded',
      db,
      redis,
      uptime: process.uptime(),
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

  private async checkRedis(): Promise<'up' | 'down'> {
    try {
      await this.cache.set('health:ping', '1', 5000);
      const v = await this.cache.get<string>('health:ping');
      return v === '1' ? 'up' : 'down';
    } catch {
      return 'down';
    }
  }
}
