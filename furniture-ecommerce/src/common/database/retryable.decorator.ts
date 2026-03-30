import { withDbRetry, type DbRetryOptions } from './with-db-retry';

/**
 * method decorator that wraps an async method with automatic DB retry logic.
 *
 * usage:
 * ```ts
 * @Injectable()
 * export class UsersRepository {
 *   constructor(private readonly logger: PinoLogger) {}
 *
 *   @Retryable()
 *   async create(data: CreateUserDto): Promise<User> {
 *     const user = this.em.create(UserEntity, data);
 *     await this.em.persistAndFlush(user);
 *     return user;
 *   }
 * }
 * ```
 */
export const Retryable = (options: Omit<DbRetryOptions, 'logger'> = {}): MethodDecorator => {
  return (_target: object, propertyKey: string | symbol, descriptor: PropertyDescriptor) => {
    const originalMethod = descriptor.value as (...args: unknown[]) => Promise<unknown>;

    descriptor.value = async function (...args: unknown[]) {
      const label = options.label ?? String(propertyKey);

      // read logger from host class instance if available
      const logger = this?.logger;

      return withDbRetry(() => originalMethod.apply(this, args), {
        ...options,
        label,
        logger,
      });
    };

    return descriptor;
  };
};
