import { CacheModuleAsyncOptions } from '@nestjs/cache-manager';
import { Logger } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { redisStore } from 'cache-manager-redis-yet';

const logger = new Logger('CacheConfig');
const DEFAULT_TTL = 15 * 60 * 1000; // 15 دقيقة (بالمللي ثانية)

/// إعداد الكاش: يحاول Redis، وإذا تعذّر الاتصال يعود إلى كاش داخل الذاكرة.
/// لا يوقف التطبيق أبداً عند غياب Redis — فقط يطبع تحذيراً ويكمل.
export const redisCacheOptions: CacheModuleAsyncOptions = {
  isGlobal: true,
  imports: [ConfigModule],
  inject: [ConfigService],
  useFactory: async (config: ConfigService) => {
    // REDIS_URL (Railway: redis://default:<password>@host:port) له الأولوية.
    const url = config.get<string>('REDIS_URL') || undefined;
    const host = config.get<string>('REDIS_HOST', 'localhost');
    const port = config.get<number>('REDIS_PORT', 6379);

    try {
      const store = await redisStore({
        url,
        socket: {
          // مع url يُستخرج المضيف/المنفذ منه؛ وإلا نستخدم HOST/PORT.
          ...(url ? {} : { host, port }),
          connectTimeout: 2000,
          // إعادة محاولة محدودة (انقطاع مؤقت)، ثم نتوقّف بدل المحاولة بلا نهاية.
          reconnectStrategy: (retries: number) =>
            url && retries < 20 ? Math.min(retries * 200, 2000) : false,
        },
        ttl: DEFAULT_TTL,
      });
      logger.log(`تم الاتصال بـ Redis (${url ? 'REDIS_URL' : `${host}:${port}`}).`);
      return { store };
    } catch (err) {
      logger.warn(
        `Redis غير متاح (${(err as Error).message}) — سيتم استخدام كاش داخل الذاكرة.`,
      );
      // إعداد بلا store ⇒ كاش افتراضي داخل الذاكرة من cache-manager.
      return { ttl: DEFAULT_TTL };
    }
  },
};
