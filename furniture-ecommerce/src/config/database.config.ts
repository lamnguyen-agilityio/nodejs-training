import { join } from 'node:path';

import { defineConfig, PostgreSqlDriver } from '@mikro-orm/postgresql';
import { config } from 'dotenv';

import { CartItemEntity } from '@/modules/carts/entities/cart-item.entity';
import { CategoryEntity } from '@/modules/categories/entities/category.entity';
import { OrderItemEntity } from '@/modules/orders/entities/order-item.entity';
import { OrderEntity } from '@/modules/orders/entities/order.entity';
import { PaymentEntity } from '@/modules/payments/entities/payment.entity';
import { ProductEntity } from '@/modules/products/entities/product.entity';
import { UserIdentityEntity } from '@/modules/user-identities/entities/user-identity.entity';
import { UserEntity } from '@/modules/users/entities/user.entity';

import { Environment } from '../common/enums';

// map NODE_ENV -> env file.
const envFileMap: Partial<Record<string, string>> = {
  production: '.env.production',
  staging: '.env.staging',
};
const envFileName = envFileMap[process.env.NODE_ENV ?? ''] ?? '.env';

config({ path: join(__dirname, '..', '..', envFileName) });

/**
 * utility function to define the database configuration.
 */
export const databaseConfig = () =>
  defineConfig({
    driver: PostgreSqlDriver,
    dbName: process.env.POSTGRES_DB,
    user: process.env.POSTGRES_USER,
    password: process.env.POSTGRES_PASSWORD,
    host: process.env.POSTGRES_HOST,
    port: Number(process.env.POSTGRES_PORT),
    entities: [
      UserEntity,
      OrderEntity,
      OrderItemEntity,
      ProductEntity,
      CategoryEntity,
      CartItemEntity,
      UserIdentityEntity,
      PaymentEntity,
    ],
    debug:
      process.env.NODE_ENV !== Environment.Production && process.env.MIKRO_ORM_DEBUG === 'true',

    migrations: {
      path: 'dist/migrations',
      ...(process.env.NODE_ENV !== 'production' &&
        process.env.NODE_ENV !== 'staging' && {
          pathTs: 'src/migrations',
        }),
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
