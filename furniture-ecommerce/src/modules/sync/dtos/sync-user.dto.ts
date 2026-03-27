import { IsEmail, IsEnum, IsString, IsUUID } from 'class-validator';

import { SocialProvider } from '@/enums';

/**
 * data required to create a shadow account in an external auth provider.
 * constructed internally by SyncService — never received from HTTP requests.
 */
export class SyncUserDto {
  @IsUUID()
  userId: string;

  @IsEmail()
  email: string;

  @IsString()
  name: string;

  @IsEnum(SocialProvider)
  socialProvider: SocialProvider;

  @IsString()
  socialProviderSub: string;
}
