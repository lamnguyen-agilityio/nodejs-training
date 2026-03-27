import type { SyncResultDto, SyncUserDto } from '../dtos';

/**
 * push a local user into the external auth provider.
 */
export interface SyncProvider {
  syncUser(dto: SyncUserDto): Promise<SyncResultDto>;
}
