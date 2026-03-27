import { Injectable } from '@nestjs/common';
import { ManagementClient } from 'auth0';
import { plainToInstance } from 'class-transformer';
import { PinoLogger } from 'nestjs-pino';

import { SocialProvider } from '@/enums';

import { SyncResultDto, type SyncUserDto } from '../dtos';
import type { SyncProvider } from '../interfaces';

/**
 * maps our internal SocialProvider to the Auth0 connection name.
 * these must match the connection names configured in your Auth0 tenant.
 */
const SOCIAL_PROVIDER_CONNECTION_MAP: Record<SocialProvider, string> = {
  [SocialProvider.Google]: 'google-oauth2',
  [SocialProvider.Github]: 'github',
};

@Injectable()
export class Auth0SyncProvider implements SyncProvider {
  private readonly client: ManagementClient;

  constructor(private readonly logger: PinoLogger) {
    this.logger.setContext(Auth0SyncProvider.name);

    this.client = new ManagementClient({
      domain: process.env.AUTH0_DOMAIN!,
      clientId: process.env.AUTH0_M2M_CLIENT_ID!,
      clientSecret: process.env.AUTH0_M2M_CLIENT_SECRET!,
    });
  }

  /**
   * syncs a user with Auth0 by creating a federated user linked to the original social identity.
   * if the user already exists, returns the existing user_id without creating a new one.
   */
  async syncUser(dto: SyncUserDto): Promise<SyncResultDto> {
    const connection = SOCIAL_PROVIDER_CONNECTION_MAP[dto.socialProvider];

    /**
     * try to find an existing Auth0 user by social provider sub first.
     * Auth0 stores federated identities as "connection|socialProviderSub".
     */
    const existingUser = await this.findExistingUser(dto.socialProvider, dto.socialProviderSub);

    if (existingUser) {
      this.logger.info(
        { auth0UserId: existingUser.user_id, userId: dto.userId },
        'Auth0 user already exists — skipping create',
      );

      return this.toSyncResult(existingUser.user_id!, false);
    }

    /**
     * create a new federated user in Auth0.
     * we use the social sub as the user_id suffix so the entry is stable
     * and predictable across re-syncs.
     */
    const created = await this.client.users.create({
      connection,
      email: dto.email,
      name: dto.name,
      email_verified: true,
      app_metadata: {
        internalUserId: dto.userId,
      },
      user_id: dto.socialProviderSub,
    });

    this.logger.info(
      { auth0UserId: created.data.user_id, userId: dto.userId },
      'Auth0 user created via sync',
    );

    return this.toSyncResult(created.data.user_id!, true);
  }

  /**
   * search Auth0 for an existing user by social identity.
   * returns null when not found rather than throwing.
   */
  private async findExistingUser(
    socialProvider: SocialProvider,
    socialProviderSub: string,
  ): Promise<{ user_id?: string } | null> {
    try {
      const connection = SOCIAL_PROVIDER_CONNECTION_MAP[socialProvider];
      const query = `identities.connection:"${connection}" AND identities.user_id:"${socialProviderSub}"`;
      const result = await this.client.users.list({ q: query, search_engine: 'v3' });

      return result.data?.[0] ?? null;
    } catch {
      this.logger.warn(
        { socialProvider, socialProviderSub },
        'Auth0 user search failed — will attempt create',
      );

      return null;
    }
  }

  /**
   * converts an external user ID and created flag into a SyncResultDto.
   */
  private toSyncResult(externalId: string, created: boolean): SyncResultDto {
    const result = plainToInstance(SyncResultDto, { externalId, created });

    return result;
  }
}
