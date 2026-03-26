import { Module } from '@nestjs/common';

import { Auth0Adapter } from './adapters/auth0.adapter';
import { ClerkAdapter } from './adapters/clerk.adapter';
import { AuthProviderFactory } from './auth-provider.factory';

@Module({
  providers: [ClerkAdapter, Auth0Adapter, AuthProviderFactory],
  exports: [AuthProviderFactory],
})
export class AuthModule {}
