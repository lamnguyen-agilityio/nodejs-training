import type { Role } from '@/common/enums';

/**
 * shape of the authenticated user attached to `request.user` by `AuthGuard`.
 */
export interface AuthenticatedUser {
  userId: string;
  email: string;
  name: string;
  role: Role;
}
