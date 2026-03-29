import { SetMetadata } from '@nestjs/common';

import { Role } from '@/common/enums';

import { ROLES_KEY } from '../guards/roles.guard';

/**
 * attach required roles to a route handler.
 */
export const Roles = (...roles: Role[]) => SetMetadata(ROLES_KEY, roles);
