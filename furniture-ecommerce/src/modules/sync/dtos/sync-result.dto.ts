import { IsBoolean, IsString } from 'class-validator';

/**
 * tells SyncService whether a new account was created or an existing
 * one was found (idempotent call).
 */
export class SyncResultDto {
  @IsString()
  externalId: string;

  @IsBoolean()
  created: boolean;
}
