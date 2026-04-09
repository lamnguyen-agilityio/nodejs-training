import { SetMetadata } from '@nestjs/common';

import { SKIP_MFA_KEY } from '../constants';

/**
 * bypass MfaGuard for routes that must be reachable before MFA is confirmed.
 */
export const SkipMfa = () => SetMetadata(SKIP_MFA_KEY, true);
