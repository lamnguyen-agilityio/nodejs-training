import { AuthProvider, SocialProvider } from '@/common/enums';
import type { User } from '@/modules/users/entities/user.entity';

/**
 * data for upserting a user identity.
 */
export interface UpsertIdentity {
  user: User;
  provider: AuthProvider;
  providerId: string;
  socialProvider: SocialProvider;
  socialProviderSub: string;
}
