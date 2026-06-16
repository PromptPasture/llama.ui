import { BaseOpenAIProvider } from './BaseOpenAIProvider';

/**
 * A provider implementation for Self-Hosted OpenAI instances.
 *
 * This class extends {@link BaseOpenAIProvider} and defines a shorter
 * token expiration threshold suitable for self-hosted environments,
 * where tokens may be refreshed more frequently due to local infrastructure
 * or security policies.
 *
 * @remarks
 * The expiration threshold is set to **60 seconds** (60,000 milliseconds),
 * reflecting the typical short-lived token validity in self-hosted deployments.
 */
export class SelfHostedOpenAIProvider extends BaseOpenAIProvider {
  /**
   * Determines whether the current API token has expired based on the last update time.
   *
   * For self-hosted providers, the token is considered expired if more than
   * 60 seconds have passed since the last update.
   *
   * @returns `true` if the token has expired; otherwise, `false`.
   * @inheritdoc
   */
  protected isExpired(): boolean {
    return Date.now() - this.lastUpdated > 60 * 1000;
  }
}
