import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import type { Request } from 'express';

import { MESSAGES } from '@/constants';

import { AuthProviderFactory } from '../auth-provider.factory';
import { AuthService } from '../auth.service';
import type { AuthenticatedUser } from '../interfaces';

@Injectable()
export class AuthGuard implements CanActivate {
  constructor(
    private readonly authProviderFactory: AuthProviderFactory,
    private readonly authService: AuthService,
  ) {}

  async canActivate(ctx: ExecutionContext): Promise<boolean> {
    const request = ctx.switchToHttp().getRequest<Request & { user: AuthenticatedUser }>();

    const token = this.extractBearerToken(request);

    // verify token with the currently active adapter (Clerk or Auth0)
    const adapter = this.authProviderFactory.getActiveAdapter();
    const profile = await adapter.verifyToken(token);

    // resolve local user + upsert identity — login flow
    const user = await this.authService.resolveUserFromProfile(profile);
    request.user = user;

    return true;
  }

  private extractBearerToken(request: Request): string {
    const authHeader = request.headers.authorization;

    if (!authHeader) {
      throw new UnauthorizedException(MESSAGES.INVALID_TOKEN);
    }

    const [scheme, token] = authHeader.split(' ');

    if (scheme?.toLowerCase() !== 'bearer' || !token) {
      throw new UnauthorizedException(MESSAGES.INVALID_TOKEN);
    }

    return token;
  }
}
