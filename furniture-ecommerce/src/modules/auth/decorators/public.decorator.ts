import { SetMetadata } from '@nestjs/common';

export const IS_PUBLIC_KEY = 'isPublic';

/**
 * marks a route as public — bypasses both AuthGuard and MfaGuard.
 * use on routes that must be accessible without any token.
 */
export const Public = () => SetMetadata(IS_PUBLIC_KEY, true);
