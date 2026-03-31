import { MikroOrmModule } from '@mikro-orm/nestjs';
import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';

import { LoggerModule } from '@/common/logger/logger.module';
import { envSchema, appConfig, databaseConfig } from '@/config';
import { AuthModule } from '@/modules/auth/auth.module';
import { CartModule } from '@/modules/cart/cart.module';
import { CategoriesModule } from '@/modules/categories/categories.module';
import { ProductsModule } from '@/modules/products/products.module';
import { UserIdentitiesModule } from '@/modules/user-identities/user-identities.module';
import { UsersModule } from '@/modules/users/users.module';

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

    // ── feature modules ──────────────────────────────────────────────────────
    UsersModule,
    UserIdentitiesModule,
    AuthModule,
    CategoriesModule,
    ProductsModule,
    CartModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
