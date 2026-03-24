import { defineConfig, PostgreSqlDriver } from '@mikro-orm/postgresql';

import { Environment } from '../enums';

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
    entities: ['./dist/**/*.entity.js'],
    entitiesTs: ['./src/**/*.entity.ts'],
    debug: process.env.NODE_ENV !== Environment.Production,
  });
