import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';

import { UserIdentitiesModule } from '@/modules/user-identities/user-identities.module';
import { UsersModule } from '@/modules/users/users.module';

import { Auth0Adapter } from './adapters/auth0.adapter';
import { ClerkAdapter } from './adapters/clerk.adapter';
import { AuthProviderFactory } from './auth-provider.factory';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { AuthGuard } from './guards/auth.guard';
import { RolesGuard } from './guards/roles.guard';
import { TokenService } from './token.service';

@Module({
  imports: [
    UsersModule,
    UserIdentitiesModule,
    JwtModule.register({
      secret: process.env.JWT_SECRET,
      signOptions: {
        expiresIn: Number(process.env.JWT_ACCESS_TOKEN_EXPIRY),
        issuer: 'nestjs-auth',
      },
    }),
  ],
  controllers: [AuthController],
  providers: [
    ClerkAdapter,
    Auth0Adapter,
    AuthProviderFactory,
    AuthService,
    TokenService,
    AuthGuard,
    RolesGuard,
  ],
  exports: [AuthProviderFactory, AuthService, AuthGuard, RolesGuard, TokenService],
})
export class AuthModule {}
