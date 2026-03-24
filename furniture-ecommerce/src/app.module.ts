import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { LoggerModule } from 'nestjs-pino';

import { pinoConfig } from '@/common/logger/logger.config';
import { envSchema, appConfig } from '@/config';

import { AppController } from './app.controller';
import { AppService } from './app.service';

@Module({
  imports: [
    ConfigModule.forRoot({
      load: [appConfig],
      isGlobal: true,
      validationSchema: envSchema,
      validationOptions: {
        abortEarly: false,
      },
    }),
    LoggerModule.forRoot(pinoConfig),
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
