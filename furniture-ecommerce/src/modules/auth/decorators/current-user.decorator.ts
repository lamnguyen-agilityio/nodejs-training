import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import type { Request } from 'express';

import { MESSAGES } from '@/common/constants';

import type { AuthenticatedUser } from '../interfaces';

/**
 * extracts the authenticated user from the request object.
 */
export const CurrentUser = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): AuthenticatedUser => {
    const request = ctx.switchToHttp().getRequest<Request & { user: AuthenticatedUser }>();

    if (!request.user) {
      throw new Error(MESSAGES.INVALID_CURRENT_USER_DECORATOR);
    }

    return request.user;
  },
);
