import { Controller, Get, UseGuards } from '@nestjs/common';

import { AuthProviderFactory } from './auth-provider.factory';
import { CurrentUser } from './decorators';
import { ProviderStatusDto } from './dtos';
import { AuthGuard, RolesGuard } from './guards';
import type { AuthenticatedUser } from './interfaces';

@Controller('auth')
@UseGuards(AuthGuard, RolesGuard)
export class AuthController {
  constructor(private readonly authProviderFactory: AuthProviderFactory) {}

  /**
   * GET /auth/me
   * returns the currently authenticated user's details.
   */
  @Get('me')
  getMe(@CurrentUser() user: AuthenticatedUser): AuthenticatedUser {
    return user;
  }

  /**
   * GET /auth/provider
   * returns the currently active provider and all registered providers.
   * accessible by any authenticated user — useful for client-side health checks.
   */
  @Get('provider')
  getProviderStatus(): ProviderStatusDto {
    return {
      active: this.authProviderFactory.getActiveProvider(),
      available: this.authProviderFactory.getRegisteredProviders(),
    };
  }
}
