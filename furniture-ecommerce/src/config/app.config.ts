import { registerAs } from '@nestjs/config';

import { API } from '@/constants';

/**
 * application configuration factory function.
 *
 * @returns configuration object with port, environment, and API prefix settings.
 */
export const appConfig = registerAs('app', () => ({
  port: Number(process.env.PORT),
  nodeEnv: process.env.NODE_ENV,
  apiPrefix: API.PREFIX,
  defaultVersion: API.VERSION.DEFAULT,
}));

/**
 * type definition for the application configuration to access configuration values.
 */
export type AppConfig = ReturnType<typeof appConfig>;
