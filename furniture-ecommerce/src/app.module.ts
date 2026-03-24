import { MikroOrmModule } from '@mikro-orm/nestjs';
import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';

import { LoggerModule } from '@/common/logger/logger.module';
import { envSchema, appConfig, databaseConfig } from '@/config';

import { AppController } from './app.controller';
import { AppService } from './app.service';

@Module({
  imports: [
    // ── env validation ───────────────────────────────────────────────────────
    ConfigModule.forRoot({
      load: [appConfig],
      isGlobal: true,
      validationSchema: envSchema,
      validationOptions: {
        abortEarly: false,
      },
    }),

    // ── logger module ────────────────────────────────────────────────────────
    LoggerModule,

    // ── database ─────────────────────────────────────────────────────────────
    MikroOrmModule.forRootAsync({
      useFactory: () => databaseConfig(),
    }),
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
