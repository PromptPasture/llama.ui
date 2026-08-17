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
   * Builds one of these rather than the base provider.
   *
   * Without it the inherited factory names its own class, so this one's
   * expiry and its answer about sampling options are both silently the base's.
   *
   * @param baseUrl - The base URL of the API endpoint
   * @param apiKey - Optional API key for authentication
   * @returns A new instance of SelfHostedOpenAIProvider
   */
  static new(baseUrl?: string, apiKey: string = ''): SelfHostedOpenAIProvider {
    return new SelfHostedOpenAIProvider(baseUrl, apiKey);
  }

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

  /**
   * Self-hosted servers accept the extended sampling parameters the settings
   * screen offers — top_k, min_p, repeat_penalty, dry_multiplier, samplers and
   * the rest are llama.cpp's own. Without this they were built from the
   * user's configuration and then dropped before the request, so every one of
   * those controls silently did nothing.
   *
   * Hosted providers keep the default of `false`: the same parameters would be
   * rejected as unrecognised by an API that only speaks OpenAI's subset.
   *
   * @returns `true`
   * @inheritdoc
   */
  protected isAllowCustomOptions(): boolean {
    return true;
  }
}
