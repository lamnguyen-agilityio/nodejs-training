import { UseGuards, applyDecorators } from '@nestjs/common';
import { ApiBearerAuth, ApiUnauthorizedResponse } from '@nestjs/swagger';

import { SWAGGER } from '@/common/constants';
import { Role } from '@/common/enums';

import { AuthGuard, RolesGuard } from '../guards';
import { Roles } from './roles.decorator';

/**
 * applies AuthGuard + ApiBearerAuth in one decorator.
 * use on any route that requires authentication.
 *
 * usage:
 * ```ts
 * @Auth()
 * getMe() {}
 * ```
 */
export const Auth = () =>
  applyDecorators(
    UseGuards(AuthGuard),
    ApiBearerAuth(SWAGGER.BEARER_AUTH_NAME),
    ApiUnauthorizedResponse({ description: 'Missing or invalid access token' }),
  );

/**
 * applies AuthGuard + RolesGuard + @Roles() + ApiBearerAuth in one decorator.
 * use on routes restricted to specific roles.
 *
 * usage:
 * ```ts
 * @AuthRoles(Role.Admin)
 * switchProvider() {}
 * ```
 */
export const AuthRoles = (...roles: Role[]) =>
  applyDecorators(
    UseGuards(AuthGuard, RolesGuard),
    Roles(...roles),
    ApiBearerAuth(SWAGGER.BEARER_AUTH_NAME),
    ApiUnauthorizedResponse({ description: 'Missing or invalid access token' }),
  );
