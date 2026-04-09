import { EntityManager } from '@mikro-orm/postgresql';
import { Injectable } from '@nestjs/common';
import { PinoLogger } from 'nestjs-pino';

import { Retryable } from '@/common/database';

import { UserEntity, type User } from './entities/user.entity';

@Injectable()
export class UsersRepository {
  constructor(
    private readonly em: EntityManager,
    private readonly logger: PinoLogger,
  ) {
    this.logger.setContext(UsersRepository.name);
  }

  /**
   * find a user by their ID or email.
   */
  async findOne(where: Partial<Pick<User, 'id' | 'email'>>): Promise<User | null> {
    if (!where.id && !where.email) {
      throw new Error('Must provide either id or email');
    }

    return await this.em.findOne(UserEntity, {
      ...where,
      deletedAt: null,
    });
  }

  /**
   * insert a new user and flush immediately.
   * returns the persisted entity.
   */
  @Retryable()
  async create(data: Pick<User, 'email' | 'name' | 'role' | 'phoneNumber'>): Promise<User> {
    // clear any pending changes from previous failed attempts
    this.em.clear();

    const user = this.em.create(UserEntity, data);
    this.em.persist(user);
    await this.em.flush();

    return user;
  }

  /**
   * apply a partial update to an existing user and flush.
   */
  @Retryable()
  async update(user: User, data: Partial<Pick<User, 'name'>>): Promise<User> {
    this.em.assign(user, data);
    await this.em.flush();

    return user;
  }

  /**
   * soft-delete: set deletedAt and flush.
   */
  @Retryable()
  async softDelete(user: User): Promise<void> {
    this.em.assign(user, { deletedAt: new Date() });
    await this.em.flush();
  }
}
