import * as net from 'net';
import { ColumnOptions, ColumnType } from 'typeorm';

export type DbDriver = 'postgres' | 'sqlite';

/// السائق الحالي كما تُقرأ من البيئة (تُقرأ تزامنياً في مزخرفات الكيانات).
/// الافتراضي sqlite حتى يعمل المشروع بدون تثبيت أي قاعدة بيانات.
export function currentDriver(): DbDriver {
  // وجود DATABASE_URL (Supabase/الإنتاج) يعني Postgres دائماً.
  if (process.env.DATABASE_URL) return 'postgres';
  return process.env.DB_DRIVER === 'postgres' ? 'postgres' : 'sqlite';
}

export const isPg = (): boolean => currentDriver() === 'postgres';

// ---- مساعدات أنواع الأعمدة المتوافقة مع القاعدتين ----

/// نوع الطابع الزمني: timestamptz لـ Postgres، datetime لـ SQLite.
export const tsType = (): ColumnType => (isPg() ? 'timestamptz' : 'datetime');

/// نوع JSON: jsonb لـ Postgres، simple-json لـ SQLite.
export const jsonType = (): ColumnType => (isPg() ? 'jsonb' : 'simple-json');

/// نوع الأرقام العشرية العائمة.
export const floatType = (): ColumnType =>
    isPg() ? 'double precision' : 'float';

/// نوع المبالغ: decimal لـ Postgres، float لـ SQLite.
export const decimalType = (): ColumnType => (isPg() ? 'decimal' : 'float');

/// نوع المعرّف الأجنبي (UUID كنص).
export const idType = (): ColumnType => (isPg() ? 'uuid' : 'varchar');

/// خيارات عمود مصفوفة نصية متوافقة.
/// Postgres: text[] — SQLite: simple-array (نص مفصول بفواصل).
export function arrayColumn(): ColumnOptions {
  return isPg()
      ? { type: 'text', array: true }
      : { type: 'simple-array' };
}

/// فحص إمكانية الوصول إلى منفذ TCP خلال مهلة.
function probeTcp(host: string, port: number, timeoutMs: number): Promise<boolean> {
  return new Promise((resolve) => {
    const socket = new net.Socket();
    let done = false;
    const finish = (ok: boolean) => {
      if (done) return;
      done = true;
      socket.destroy();
      resolve(ok);
    };
    socket.setTimeout(timeoutMs);
    socket.once('connect', () => finish(true));
    socket.once('timeout', () => finish(false));
    socket.once('error', () => finish(false));
    socket.connect(port, host);
  });
}

/// يقرّر السائق: يحترم DB_DRIVER إن حُدّد، وإلا يفحص منفذ Postgres،
/// فإن كان متاحاً يستخدمه، وإلا يعود إلى SQLite. يضبط process.env.DB_DRIVER.
export async function resolveDbDriver(): Promise<DbDriver> {
  if (process.env.DATABASE_URL) {
    process.env.DB_DRIVER = 'postgres';
    return 'postgres';
  }
  if (process.env.DB_DRIVER === 'postgres') return 'postgres';
  if (process.env.DB_DRIVER === 'sqlite') return 'sqlite';

  const host = process.env.DB_HOST ?? 'localhost';
  const port = Number(process.env.DB_PORT ?? 5432);
  const reachable = await probeTcp(host, port, 1500);
  const driver: DbDriver = reachable ? 'postgres' : 'sqlite';
  process.env.DB_DRIVER = driver;

  if (!reachable) {
    // eslint-disable-next-line no-console
    console.warn(
      `⚠️  تعذّر الوصول إلى Postgres (${host}:${port}) — سيتم استخدام SQLite للتطوير.`,
    );
  }
  return driver;
}
