import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';

import { versioningConfig, AppConfig } from '@/config';

import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  const { port, apiPrefix } = app.get(ConfigService).getOrThrow<AppConfig>('app');

  // ── global prefix & versioning ────────────────────────────────
  app.setGlobalPrefix(apiPrefix);
  app.enableVersioning(versioningConfig());

  await app.listen(port);
}
bootstrap();
