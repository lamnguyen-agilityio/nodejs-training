import { EntityManager } from '@mikro-orm/postgresql';
import { Injectable } from '@nestjs/common';

import { UserEntity, type User } from './entities/user.entity';

@Injectable()
export class UsersRepository {
  constructor(private readonly em: EntityManager) {}

  /**
   * find a user by their ID or email.
   */
  async findOne(where: Partial<Pick<User, 'id' | 'email'>>): Promise<User | null> {
    return this.em.findOne(UserEntity, {
      ...where,
      deletedAt: null,
    });
  }

  /**
   * insert a new user and flush immediately.
   * returns the persisted entity.
   */
  async create(data: Pick<User, 'email' | 'name' | 'role'>): Promise<User> {
    const user = this.em.create(UserEntity, data);
    this.em.persist(user);
    await this.em.flush();

    return user;
  }

  /**
   * apply a partial update to an existing user and flush.
   */
  async update(user: User, data: Partial<Pick<User, 'name'>>): Promise<User> {
    this.em.assign(user, data);
    await this.em.flush();

    return user;
  }

  /**
   * soft-delete: set deletedAt and flush.
   */
  async softDelete(user: User): Promise<void> {
    this.em.assign(user, { deletedAt: new Date() });
    await this.em.flush();
  }
}
