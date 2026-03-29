import { Injectable, NotFoundException } from '@nestjs/common';

import { Role } from '@/common/enums';

import type { User } from './entities/user.entity';
import type { CreateUserDto, UpdateUserDto } from './interfaces';
import { UsersRepository } from './users.repository';

@Injectable()
export class UsersService {
  constructor(private readonly usersRepository: UsersRepository) {}

  /**
   * find a user by id or email.
   */
  async findOne(where: Partial<Pick<User, 'id' | 'email'>>): Promise<User> {
    const user = await this.usersRepository.findOne(where);
    if (!user) throw new NotFoundException(`User ${where.id ?? where.email} not found`);

    return user;
  }

  /**
   * find an existing user by email or create a new one.
   * used by the auth flow on first login to ensure a local user record exists.
   */
  async findOrCreate(dto: CreateUserDto): Promise<{ user: User; created: boolean }> {
    const existing = await this.usersRepository.findOne({ email: dto.email });
    if (existing) return { user: existing, created: false };

    const { email, name } = dto;

    const user = await this.usersRepository.create({
      email,
      name,
      role: Role.User, // default role User
    });

    return { user, created: true };
  }

  /**
   * update a user by id.
   */
  async update(id: string, dto: UpdateUserDto): Promise<User> {
    const user = await this.findOne({ id });

    return this.usersRepository.update(user, dto);
  }

  /**
   * soft delete a user by id.
   */
  async softDelete(id: string): Promise<void> {
    const user = await this.findOne({ id });
    await this.usersRepository.softDelete(user);
  }
}
