import * as Joi from 'joi';

/// مخطّط Joi للتحقق من متغيّرات البيئة عند الإقلاع.
export const envValidationSchema = Joi.object({
  // Database — DB_DRIVER فارغ = اكتشاف تلقائي (postgres إن توفّر وإلا sqlite).
  DB_DRIVER: Joi.string().valid('postgres', 'sqlite').allow('').default(''),
  SQLITE_PATH: Joi.string().default('jawwak-dev.sqlite'),
  DB_HOST: Joi.string().default('localhost'),
  DB_PORT: Joi.number().default(5432),
  DB_NAME: Joi.string().allow('').optional(),
  DB_USER: Joi.string().allow('').optional(),
  DB_PASS: Joi.string().allow('').optional(),
  // الإنتاج (Supabase): رابط اتصال كامل — يفرض سائق postgres ويفعّل SSL.
  DATABASE_URL: Joi.string()
    .uri({ scheme: ['postgres', 'postgresql'] })
    .allow('')
    .optional(),
  DB_SSL: Joi.string().valid('true', 'false').allow('').optional(),

  // Redis — REDIS_URL (Railway) له الأولوية على HOST/PORT.
  REDIS_URL: Joi.string().allow('').optional(),
  REDIS_HOST: Joi.string().default('localhost'),
  REDIS_PORT: Joi.number().default(6379),

  // Firebase — اختيارية في التطوير
  FIREBASE_PROJECT_ID: Joi.string().allow('').optional(),
  FIREBASE_PRIVATE_KEY: Joi.string().allow('').optional(),
  FIREBASE_CLIENT_EMAIL: Joi.string().allow('').optional(),

  // App
  PORT: Joi.number().default(3000),
  NODE_ENV: Joi.string()
    .valid('development', 'production', 'test')
    .default('development'),
  API_PREFIX: Joi.string().default('api/v1'),
  CORS_ORIGINS: Joi.string().default('http://localhost:3000'),

  // الزرع التلقائي عند الإقلاع (تطوير فقط) — 'false' لتعطيله.
  SEED_ON_BOOT: Joi.string().valid('true', 'false').default('true'),

  // المشرفون (فريق جوّك): أرقام جوال بصيغة ‎+9665…‎ مفصولة بفواصل.
  ADMIN_PHONES: Joi.string().allow('').optional(),

  // QR
  QR_SECRET_KEY: Joi.string().min(16).required(),
  QR_HMAC_KEY: Joi.string().min(16).required(),

  // Rate limiting
  THROTTLE_TTL: Joi.number().default(60),
  THROTTLE_LIMIT: Joi.number().default(100),

  // HyperPay (بوّابة الدفع) — اختيارية؛ تُعطَّل عند غيابها.
  HYPERPAY_BASE_URL: Joi.string().default('https://eu-test.oppwa.com'),
  HYPERPAY_ENTITY_ID: Joi.string().allow('').optional(),
  HYPERPAY_ACCESS_TOKEN: Joi.string().allow('').optional(),
  HYPERPAY_MADA_ENTITY_ID: Joi.string().allow('').optional(),
  // سرّ فكّ تشفير الـ Webhook (hex) — بدونه تُرفض كل الإشعارات.
  HYPERPAY_WEBHOOK_SECRET: Joi.string().allow('').optional(),
  APP_BASE_URL: Joi.string().default('http://localhost:3000'),
});
