import 'dotenv/config';

import { Logger, RequestMethod, ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import { NestExpressApplication } from '@nestjs/platform-express';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import compression from 'compression';
import helmet from 'helmet';

import { resolveDbDriver } from './config/db-driver';

async function bootstrap(): Promise<void> {
  const logger = new Logger('Bootstrap');

  // نحسم سائق قاعدة البيانات (postgres/sqlite) قبل تحميل الكيانات،
  // لأن أنواع الأعمدة تُقرأ من DB_DRIVER عند استيراد الكيانات.
  const driver = await resolveDbDriver();
  logger.log(`سائق قاعدة البيانات: ${driver}`);

  // استيراد ديناميكي بعد ضبط DB_DRIVER.
  const { AppModule } = await import('./app.module');

  const app = await NestFactory.create<NestExpressApplication>(AppModule, {
    cors: false,
  });
  const config = app.get(ConfigService);
  const isProd = config.get<string>('NODE_ENV') === 'production';

  // خلف وكيل Railway: نثق بأول وكيل ليصبح req.ip عنوان العميل الحقيقي،
  // وإلا يحسب الحدّ من المعدّل (Throttler) كل المستخدمين كعنوان واحد.
  app.set('trust proxy', 1);
  // إشعارات HyperPay تصل كنص hex مشفّر (text/plain).
  app.useBodyParser('text', { type: 'text/plain' });

  const apiPrefix = config.get<string>('API_PREFIX', 'api/v1');
  // نستثني المسار الجذر '/' من البادئة ليخدم رسالة الترحيب مباشرةً.
  app.setGlobalPrefix(apiPrefix, {
    exclude: [{ path: '/', method: RequestMethod.GET }],
  });

  app.use(helmet());
  app.use(compression());

  const origins = config
    .get<string>('CORS_ORIGINS', 'http://localhost:3000')
    .split(',')
    .map((o) => o.trim());
  app.enableCors({ origin: origins, credentials: true });

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      transformOptions: { enableImplicitConversion: true },
    }),
  );

  // Swagger في التطوير فقط.
  if (!isProd) {
    const swaggerConfig = new DocumentBuilder()
      .setTitle('Jawwak API - جوّك')
      .setDescription(
        'Backend API for Jawwak mood-based venue recommendation app',
      )
      .setVersion('1.0.0')
      .addBearerAuth()
      .build();
    const document = SwaggerModule.createDocument(app, swaggerConfig);
    SwaggerModule.setup('api/docs', app, document);
  }

  const port = config.get<number>('PORT', 3000);
  // 0.0.0.0 ليكون الخادم متاحاً من خارج الحاوية (Railway/Docker).
  await app.listen(port, '0.0.0.0');
  logger.log(`🚀 جوّك API يعمل على المنفذ ${port} (/${apiPrefix})`);
  if (!isProd) logger.log(`📚 Swagger: http://localhost:${port}/api/docs`);
}

bootstrap();
