import { Module } from '@nestjs/common';

import { UserIdentitiesModule } from '@/modules/user-identities/user-identities.module';
import { UsersModule } from '@/modules/users/users.module';

import { Auth0Adapter } from './adapters/auth0.adapter';
import { ClerkAdapter } from './adapters/clerk.adapter';
import { AuthProviderFactory } from './auth-provider.factory';
import { AuthService } from './auth.service';
import { AuthGuard } from './guards/auth.guard';

@Module({
  imports: [UsersModule, UserIdentitiesModule],
  providers: [ClerkAdapter, Auth0Adapter, AuthProviderFactory, AuthService, AuthGuard],
  exports: [AuthProviderFactory, AuthService, AuthGuard],
})
export class AuthModule {}
