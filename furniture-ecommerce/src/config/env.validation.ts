import Joi from 'joi';

import { Environment } from '@/enums';

/**
 * env schema make sure all variables inside .env file have valid values
 */
export const envSchema = Joi.object({
  // Application
  NODE_ENV: Joi.string()
    .valid(...Object.values(Environment))
    .required(),
  PORT: Joi.number().port().required(),

  // Database
  POSTGRES_HOST: Joi.string().hostname().required(),
  POSTGRES_DB: Joi.string().required(),
  POSTGRES_USER: Joi.string().required(),
  POSTGRES_PASSWORD: Joi.string().required(),
  POSTGRES_PORT: Joi.number().port().required(),
}).options({ allowUnknown: true });
