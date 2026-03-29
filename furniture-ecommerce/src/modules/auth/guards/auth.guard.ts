import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import type { Request } from 'express';
import { PinoLogger } from 'nestjs-pino';

import { MESSAGES } from '@/constants';

import { AuthenticatedUserDto } from '../dtos';
import type { AuthenticatedUser } from '../interfaces';
import { TokenService } from '../token.service';

@Injectable()
export class AuthGuard implements CanActivate {
  constructor(
    private readonly logger: PinoLogger,
    private readonly tokenService: TokenService,
  ) {
    this.logger.setContext(AuthGuard.name);
  }

  canActivate(ctx: ExecutionContext): boolean {
    const request = ctx.switchToHttp().getRequest<Request & { user: AuthenticatedUser }>();

    const token = this.extractBearerToken(request);
    const payload = this.tokenService.verifyAccessToken(token);

    const { sub, email, role, name } = payload;

    request.user = AuthenticatedUserDto.from({ userId: sub, email, name, role });

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
