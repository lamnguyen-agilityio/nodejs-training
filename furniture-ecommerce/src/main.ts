import { NestFactory } from '@nestjs/core';

import { appConfig, versioningConfig } from '@/config';

import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  const { port, apiPrefix } = appConfig();

  // ── global prefix & versioning ────────────────────────────────
  app.setGlobalPrefix(apiPrefix);
  app.enableVersioning(versioningConfig());

  await app.listen(port);
}
bootstrap();
