import { DocumentBuilder } from '@nestjs/swagger';
import type { SwaggerCustomOptions } from '@nestjs/swagger';

import { SWAGGER } from '@/common/constants';

/**
 * configuration for the Swagger UI.
 */
export const swaggerConfig = () =>
  new DocumentBuilder()
    .setTitle('Furniture E-commerce API')
    .setDescription('REST API documentation for Furniture E-commerce')
    .setVersion('1.0')
    .addBearerAuth(
      {
        type: 'http',
        scheme: 'bearer',
        bearerFormat: 'JWT',
        name: 'Authorization',
        in: 'header',
      },
      SWAGGER.BEARER_AUTH_NAME,
    )
    .build();

/**
 * configuration for the Swagger UI options.
 */
export const swaggerUiConfig: SwaggerCustomOptions = {
  swaggerOptions: {
    persistAuthorization: true,
    tagsSorter: 'alpha',
    operationsSorter: 'alpha',
  },
  customSiteTitle: 'Furniture API Docs',
};
