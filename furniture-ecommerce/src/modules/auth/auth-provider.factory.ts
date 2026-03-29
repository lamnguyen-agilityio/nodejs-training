import { Injectable, OnModuleInit } from '@nestjs/common';
import { PinoLogger } from 'nestjs-pino';

import { AuthProvider } from '@/enums';

import type { AuthProviderAdapter } from './adapters/auth-provider.adapter';
import { Auth0Adapter } from './adapters/auth0.adapter';
import { ClerkAdapter } from './adapters/clerk.adapter';

/**
 * resolves the currently active `AuthProviderAdapter`.
 *
 * design decisions:
 *  - follows the **Factory** pattern: callers ask for the active
 *    adapter; they don't care which concrete class they receive.
 *  - provider selection lives in-memory (loaded from `AUTH_PROVIDER` env var
 *    on startup) so there is zero DB overhead on the hot path.
 *  - `switchProvider()` mutates the in-memory state instantly, meaning
 *    subsequent requests start using the new adapter without a restart.
 *  - the map of adapters is populated once on `onModuleInit`; adding a third
 *    provider only requires adding its adapter to the map.
 */
@Injectable()
export class AuthProviderFactory implements OnModuleInit {
  // all registered adapters keyed by their `AuthProvider` enum value.
  private readonly adapters = new Map<AuthProvider, AuthProviderAdapter>();

  // the currently active provider. Mutated by `switchProvider()`.
  private activeProvider: AuthProvider;

  constructor(
    private readonly clerkAdapter: ClerkAdapter,
    private readonly auth0Adapter: Auth0Adapter,
    private readonly logger: PinoLogger,
  ) {}

  onModuleInit(): void {
    this.logger.setContext(AuthProviderFactory.name);

    // register all adapters.
    this.adapters.set(AuthProvider.Clerk, this.clerkAdapter);
    this.adapters.set(AuthProvider.Auth0, this.auth0Adapter);

    // read initial provider from environment; default to Clerk.
    const envProvider = process.env.AUTH_PROVIDER as AuthProvider | undefined;
    this.activeProvider =
      envProvider && this.adapters.has(envProvider) ? envProvider : AuthProvider.Clerk;

    this.logger.info(`Auth provider initialised: ${this.activeProvider}`);
  }

  // ─────────────────────────────────────────────────────────────
  // public API
  // ─────────────────────────────────────────────────────────────

  /**
   * returns the adapter for the currently active provider.
   * used by AuthGuard on every request.
   */
  getActiveAdapter(): AuthProviderAdapter {
    return this.adapters.get(this.activeProvider)!;
  }

  /**
   * returns the name of the currently active provider.
   * exposed by the admin endpoint so ops can confirm the current state.
   */
  getActiveProvider(): AuthProvider {
    return this.activeProvider;
  }

  /**
   * switch the active provider at runtime without restarting the server.
   * called by the admin API when Clerk is down or during planned maintenance.
   *
   * throws if `provider` is not registered — prevents switching to an
   * uninitialized or misconfigured adapter.
   */
  switchProvider(provider: AuthProvider): void {
    if (!this.adapters.has(provider)) {
      throw new Error(`Unknown auth provider: ${provider}`);
    }

    const previous = this.activeProvider;
    this.activeProvider = provider;

    this.logger.warn(`Auth provider switched: ${previous} → ${provider}`);
  }

  /**
   * list all registered provider names.
   */
  getRegisteredProviders(): AuthProvider[] {
    return [...this.adapters.keys()];
  }
}
