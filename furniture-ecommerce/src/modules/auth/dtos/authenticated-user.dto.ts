import { ApiProperty } from '@nestjs/swagger';
import { Expose, plainToInstance } from 'class-transformer';
import { IsEmail, IsEnum, IsString, IsUUID } from 'class-validator';

import { Role } from '@/common/enums';

import type { AuthenticatedUser } from '../interfaces/authenticated-user.interface';

/**
 * validated DTO used inside AuthGuard to enforce the shape of the
 * authenticated user before attaching to request.user.
 */
export class AuthenticatedUserDto implements AuthenticatedUser {
  @ApiProperty({
    description: 'Internal user id (UUID v7)',
    example: '019d2eb0-cad6-72e1-9149-cbec8767a59b',
  })
  @IsUUID()
  @Expose()
  userId: string;

  @ApiProperty({
    description: 'Verified email address',
    example: 'user@example.com',
  })
  @IsEmail()
  @Expose()
  email: string;

  @ApiProperty({
    description: 'Display name',
    example: 'John Doe',
  })
  @IsString()
  @Expose()
  name: string;

  @ApiProperty({
    description: 'Application-level role',
    enum: Role,
    example: Role.User,
  })
  @IsEnum(Role)
  @Expose()
  role: Role;

  static from(user: AuthenticatedUser): AuthenticatedUserDto {
    return plainToInstance(AuthenticatedUserDto, user);
  }
}
