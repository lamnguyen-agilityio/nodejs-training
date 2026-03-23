import { CorsOptions } from '@nestjs/common/interfaces/external/cors-options.interface';

/**
 * configuration for the CORS middleware.
 */
export const corsConfig = (): CorsOptions => ({
  origin: process.env.ALLOWED_ORIGINS?.split(',') || '*',
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  credentials: true,
});
