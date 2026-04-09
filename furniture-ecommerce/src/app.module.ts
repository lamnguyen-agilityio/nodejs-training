import { MikroOrmModule } from '@mikro-orm/nestjs';
import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_GUARD } from '@nestjs/core';

import { LoggerModule } from '@/common/logger/logger.module';
import { envSchema, appConfig, databaseConfig } from '@/config';
import { AuthModule } from '@/modules/auth/auth.module';
import { AuthGuard } from '@/modules/auth/guards/';
import { CartsModule } from '@/modules/carts/carts.module';
import { CategoriesModule } from '@/modules/categories/categories.module';
import { MfaGuard } from '@/modules/mfa/guards/mfa.guard';
import { MfaModule } from '@/modules/mfa/mfa.module';
import { OrdersModule } from '@/modules/orders/orders.module';
import { PaymentsModule } from '@/modules/payments/payments.module';
import { ProductsModule } from '@/modules/products/products.module';
import { UserIdentitiesModule } from '@/modules/user-identities/user-identities.module';
import { UsersModule } from '@/modules/users/users.module';
import { WebhookModule } from '@/modules/webhook/webhook.module';

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
    CartsModule,
    OrdersModule,
    PaymentsModule,
    WebhookModule,
    MfaModule,
  ],
  controllers: [AppController],
  providers: [
    AppService,
    { provide: APP_GUARD, useClass: AuthGuard },
    { provide: APP_GUARD, useClass: MfaGuard },
  ],
})
export class AppModule {}
