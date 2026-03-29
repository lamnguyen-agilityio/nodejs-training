import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { Request } from 'express';

import { MESSAGES, ROLES_KEY } from '@/constants';
import { Role } from '@/enums';

import type { AuthenticatedUser } from '../interfaces';

/**
 * enforces role-based access control.
 *
 * always used AFTER AuthGuard since it reads request.user
 * which is set by AuthGuard.
 *
 * if no @Roles() decorator is present on the handler, the guard
 * passes through — allowing any authenticated user.
 */
@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(ctx: ExecutionContext): boolean {
    const requiredRoles = this.reflector.getAllAndOverride<Role[]>(ROLES_KEY, [
      ctx.getHandler(),
      ctx.getClass(),
    ]);

    // no @Roles() decorator — allow any authenticated user through.
    const isNoRoles = !requiredRoles || requiredRoles.length === 0;
    if (isNoRoles) return true;

    const request = ctx.switchToHttp().getRequest<Request & { user: AuthenticatedUser }>();

    const { user } = request;

    if (!user || !requiredRoles.includes(user.role)) {
      throw new ForbiddenException(MESSAGES.FORBIDDEN);
    }

    return true;
  }
}
