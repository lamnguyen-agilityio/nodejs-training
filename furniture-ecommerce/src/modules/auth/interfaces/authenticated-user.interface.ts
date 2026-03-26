import type { Role } from '@/enums';

/**
 * shape of the authenticated user attached to `request.user` by `AuthGuard`.
 */
export interface AuthenticatedUser {
  userId: string;
  email: string;
  name: string;
  role: Role;
}
