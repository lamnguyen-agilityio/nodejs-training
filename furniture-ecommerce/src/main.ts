import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import { SwaggerModule } from '@nestjs/swagger';
import helmet from 'helmet';

import {
  versioningConfig,
  AppConfig,
  swaggerConfig,
  swaggerUiConfig,
  helmetConfig,
  corsConfig,
} from '@/config';

import { AppModule } from './app.module';
import { Environment } from './enums';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  const { port, apiPrefix, nodeEnv } = app.get(ConfigService).getOrThrow<AppConfig>('app');

  // ── security ──────────────────────────────────────────────────
  app.use(helmet(helmetConfig(nodeEnv)));
  app.enableCors(corsConfig());

  // ── global prefix & versioning ────────────────────────────────
  app.setGlobalPrefix(apiPrefix);
  app.enableVersioning(versioningConfig());

  // ── swagger (non-production only) ─────────────────────────────
  if (nodeEnv !== Environment.Production) {
    const document = SwaggerModule.createDocument(app, swaggerConfig());
    SwaggerModule.setup(`${apiPrefix}/docs`, app, document, swaggerUiConfig);
  }

  await app.listen(port);
}
bootstrap();
