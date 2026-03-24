import { join } from 'node:path';

import { defineConfig, PostgreSqlDriver } from '@mikro-orm/postgresql';
import { config } from 'dotenv';

import { Environment } from '../enums';

// map NODE_ENV -> env file
const envFileMap: Partial<Record<string, string>> = {
  production: '.env.production',
  staging: '.env.staging',
};
const envFileName = envFileMap[process.env.NODE_ENV ?? ''] ?? '.env';

config({ path: join(__dirname, '..', '..', envFileName) });

/**
 * defineConfig utility function to define the database configuration.
 */
export const databaseConfig = () =>
  defineConfig({
    driver: PostgreSqlDriver,
    dbName: process.env.POSTGRES_DB,
    user: process.env.POSTGRES_USER,
    password: process.env.POSTGRES_PASSWORD,
    host: process.env.POSTGRES_HOST,
    port: Number(process.env.POSTGRES_PORT),
    entities: [join(__dirname, '..', '**', '*.entity.js')],
    entitiesTs: [join(__dirname, '..', '**', '*.entity.ts')],
    debug:
      process.env.NODE_ENV !== Environment.Production && process.env.MIKRO_ORM_DEBUG === 'true',

    migrations: {
      path: './dist/migrations',
      pathTs: './src/migrations',
      glob: '!(*.d).{js,ts}',
      transactional: true,
      allOrNothing: true,
      dropTables: false,
      emit: 'ts',
    },
  });

/**
 * export default for migration configuration.
 */
export default databaseConfig();
