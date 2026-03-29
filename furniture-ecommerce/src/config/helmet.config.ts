import type { HelmetOptions } from 'helmet';

import { Environment } from '@/common/enums';

/**
 * configures Helmet middleware options based on the current environment.
 *
 * @param nodeEnv - the current environment.
 * @returns the configured Helmet options.
 */
export const helmetConfig = (nodeEnv: Environment): HelmetOptions => {
  const isProduction = nodeEnv === Environment.Production;

  return {
    contentSecurityPolicy: isProduction,
    crossOriginEmbedderPolicy: isProduction,
  };
};
