import { BaseOpenAIProvider } from './BaseOpenAIProvider';

/**
 * A provider implementation for Cloud-based OpenAI services (e.g., OpenAI API).
 *
 * This class extends {@link BaseOpenAIProvider} and defines a longer
 * token expiration threshold appropriate for cloud-based APIs,
 * where token refresh cycles are typically longer and less frequent.
 *
 * @remarks
 * The expiration threshold is set to **15 minutes** (900,000 milliseconds),
 * aligning with standard token lifetimes in OpenAI's cloud API offerings.
 */
export class CloudOpenAIProvider extends BaseOpenAIProvider {
  /**
   * Determines whether the current API token has expired based on the last update time.
   *
   * For cloud providers, the token is considered expired if more than
   * 15 minutes have passed since the last update.
   *
   * @returns `true` if the token has expired; otherwise, `false`.
   * @inheritdoc
   */
  protected isExpired(): boolean {
    return Date.now() - this.lastUpdated > 15 * 60 * 1000;
  }

  /** @inheritdoc */
  protected isAllowCustomOptions(): boolean {
    return false;
  }
}
