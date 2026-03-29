import { registerAs } from '@nestjs/config';

import { API } from '@/common/constants';
import { Environment } from '@/common/enums';

/**
 * application configuration factory function.
 *
 * @returns configuration object with port, environment, and API prefix settings.
 */
export const appConfig = registerAs('app', () => ({
  port: Number(process.env.PORT),
  nodeEnv: process.env.NODE_ENV as Environment,
  apiPrefix: API.PREFIX,
  defaultVersion: API.VERSION.DEFAULT,
  logLevel: process.env.LOG_LEVEL,
}));

/**
 * type definition for the application configuration to access configuration values.
 */
export type AppConfig = ReturnType<typeof appConfig>;
