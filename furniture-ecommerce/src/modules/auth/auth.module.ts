import { Module } from '@nestjs/common';

import { UserIdentitiesModule } from '@/modules/user-identities/user-identities.module';
import { UsersModule } from '@/modules/users/users.module';

import { Auth0Adapter } from './adapters/auth0.adapter';
import { ClerkAdapter } from './adapters/clerk.adapter';
import { AuthProviderFactory } from './auth-provider.factory';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { AuthGuard } from './guards/auth.guard';
import { RolesGuard } from './guards/roles.guard';

@Module({
  imports: [UsersModule, UserIdentitiesModule],
  controllers: [AuthController],
  providers: [ClerkAdapter, Auth0Adapter, AuthProviderFactory, AuthService, AuthGuard, RolesGuard],
  exports: [AuthProviderFactory, AuthService, AuthGuard, RolesGuard],
})
export class AuthModule {}
