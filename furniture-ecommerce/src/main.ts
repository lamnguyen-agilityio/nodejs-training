import { ClassSerializerInterceptor, ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestFactory, Reflector } from '@nestjs/core';
import { SwaggerModule } from '@nestjs/swagger';
import helmet from 'helmet';
import { Logger, LoggerErrorInterceptor } from 'nestjs-pino';

import { HttpExceptionFilter } from '@/common/filters/http-exception.filter';
import {
  versioningConfig,
  AppConfig,
  swaggerConfig,
  swaggerUiConfig,
  helmetConfig,
  corsConfig,
} from '@/config';

import { AppModule } from './app.module';
import { Environment } from './common/enums';

async function bootstrap() {
  const app = await NestFactory.create(AppModule, {
    bufferLogs: true,
  });
  const reflector = app.get(Reflector);
  const { port, apiPrefix, nodeEnv } = app.get(ConfigService).getOrThrow<AppConfig>('app');

  // ── security ──────────────────────────────────────────────────
  app.use(helmet(helmetConfig(nodeEnv)));
  app.enableCors(corsConfig());

  // ── versioning ────────────────────────────────
  app.enableVersioning(versioningConfig());

  // ── global providers ──────────────────────────────────────────
  app.useGlobalFilters(new HttpExceptionFilter());
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );
  app.useGlobalInterceptors(
    new ClassSerializerInterceptor(reflector, {
      strategy: 'excludeAll',
      excludeExtraneousValues: true,
    }),
    new LoggerErrorInterceptor(),
  );

  // ── logger ──────────────────────────────────────────
  app.useLogger(app.get(Logger));

  // ── swagger (non-production only) ─────────────────────────────
  if (nodeEnv !== Environment.Production) {
    const document = SwaggerModule.createDocument(app, swaggerConfig());
    SwaggerModule.setup(`${apiPrefix}/docs`, app, document, swaggerUiConfig);
  }

  await app.listen(port);
}
bootstrap();
