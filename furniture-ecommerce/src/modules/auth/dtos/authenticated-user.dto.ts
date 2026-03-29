import { Expose } from 'class-transformer';
import { IsEmail, IsEnum, IsString, IsUUID } from 'class-validator';

import { Role } from '@/enums';

import type { AuthenticatedUser } from '../interfaces/authenticated-user.interface';

/**
 * validated DTO used inside AuthGuard to enforce the shape of the
 * authenticated user before attaching to request.user.
 */
export class AuthenticatedUserDto implements AuthenticatedUser {
  @IsUUID()
  @Expose()
  userId: string;

  @IsEmail()
  @Expose()
  email: string;

  @IsString()
  @Expose()
  name: string;

  @IsEnum(Role)
  @Expose()
  role: Role;
}
