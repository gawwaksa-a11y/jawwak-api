import { ConfigService } from '@nestjs/config';
import { TypeOrmModuleOptions } from '@nestjs/typeorm';

import { currentDriver } from './db-driver';
import { migrationsGlob, pgConnection } from './pg-connection';

/// إعداد اتصال TypeORM حسب السائق المتاح:
/// - postgres: DATABASE_URL (Supabase) أو إعدادات DB_HOST المحلية
/// - sqlite (sql.js) كبديل للتطوير بدون تثبيت أي قاعدة بيانات
///
/// الإنتاج: synchronize معطّل، وتُشغَّل الـ migrations تلقائياً عند الإقلاع.
/// التطوير: synchronize مفعّل (ينشئ المخطط من الكيانات مباشرةً).
export const buildTypeOrmOptions = (
  config: ConfigService,
): TypeOrmModuleOptions => {
  const isProd = config.get<string>('NODE_ENV') === 'production';
  const logging = !isProd ? (['error'] as ['error']) : (['error', 'migration'] as ['error', 'migration']);

  if (currentDriver() === 'sqlite') {
    // sql.js: قاعدة SQLite بالكامل في الذاكرة (WASM) بلا بناء أصلي،
    // مع حفظ تلقائي إلى ملف — بديل مثالي للتطوير بلا تثبيت.
    return {
      type: 'sqljs',
      autoSave: true,
      location: config.get<string>('SQLITE_PATH') ?? 'jawwak-dev.sqlite',
      autoLoadEntities: true,
      synchronize: true,
      logging,
    };
  }

  return {
    type: 'postgres',
    ...pgConnection(),
    // gen_random_uuid() مدمجة في Postgres 13+ (Supabase) — لا حاجة لـ uuid-ossp.
    uuidExtension: 'pgcrypto',
    autoLoadEntities: true,
    synchronize: !isProd,
    migrations: [migrationsGlob],
    migrationsRun: isProd,
    logging,
  };
};
