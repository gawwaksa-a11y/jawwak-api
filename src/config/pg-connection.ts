import * as path from 'path';

/// بيانات اتصال Postgres المشتركة بين التطبيق وأدوات CLI (migrations/seed).
///
/// - DATABASE_URL (Supabase/الإنتاج) له الأولوية، مع SSL مفعّل افتراضياً.
/// - وإلا DB_HOST/DB_PORT/DB_USER/DB_PASS/DB_NAME (Postgres محلي بلا SSL).
/// - DB_SSL=true|false يفرض تفعيل/تعطيل SSL صراحةً.
export function pgConnection(env: NodeJS.ProcessEnv = process.env) {
  const url = env.DATABASE_URL || undefined;
  const sslOn = env.DB_SSL ? env.DB_SSL === 'true' : Boolean(url);
  // Supabase يوقّع شهاداته بجهة خاصة؛ rejectUnauthorized=false هو الإعداد الموصى به
  // ما لم تُرفق شهادة الجهة (CA) صراحةً.
  const ssl = sslOn ? { rejectUnauthorized: false } : false;

  if (url) return { url, ssl };
  return {
    host: env.DB_HOST ?? 'localhost',
    port: Number(env.DB_PORT ?? 5432),
    username: env.DB_USER,
    password: env.DB_PASS,
    database: env.DB_NAME,
    ssl,
  };
}

/// مسار ملفات الـ migrations: ‎.ts عند التشغيل عبر ts-node، و‎.js من dist
/// (نتجنّب نمط ‎*.{ts,js}‎ حتى لا تُلتقط ملفات ‎.d.ts‎ في dist).
export const migrationsGlob = path.join(
  __dirname,
  '..',
  'database',
  'migrations',
  __filename.endsWith('.ts') ? '*.ts' : '*.js',
);
