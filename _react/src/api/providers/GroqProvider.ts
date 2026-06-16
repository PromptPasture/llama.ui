import { InferenceApiModel } from '../../types';
import { CloudOpenAIProvider } from './CloudOpenAIProvider';

/**
 * Represents a Grok model as returned by the API.
 *
 * @interface GrokModel
 * @property {string} id - The unique identifier of the model.
 * @property {string} object - The object type, typically "model".
 * @property {number} created - Unix timestamp indicating when the model was created.
 * @property {string} owned_by - The organization that owns the model (e.g., "xai").
 * @property {boolean} active - Whether the model is currently active and available for inference.
 * @property {number} context_window - The maximum number of tokens the model can handle in a single request.
 */
interface GroqModel {
  id: string;
  object: string;
  created: number;
  owned_by: string;
  active: boolean;
  context_window: number;
}

/**
 * Provider implementation for interacting with the Grok AI model API.
 *
 * Extends {@link CloudOpenAIProvider} to support Grok-specific model responses
 * and API endpoints. Grok is developed by xAI (Elon Musk's team) and follows
 * a similar API structure to OpenAI, but with its own model identifiers and
 * authentication.
 *
 * @see https://console.groq.com/docs/api-reference
 *
 * @extends CloudOpenAIProvider
 */
export class GroqProvider extends CloudOpenAIProvider {
  /**
   * Creates a new instance of the GrokProvider.
   *
   * This is a static factory method that provides a convenient way to instantiate
   * the provider with optional base URL and required API key.
   *
   * @param baseUrl - Optional custom base URL for the Grok API endpoint.
   *                  Defaults to the default endpoint used by CloudOpenAIProvider.
   * @param apiKey - The API key for authenticating requests to the Grok API.
   *                 Must be provided; empty string will cause authentication failures.
   * @returns A new instance of GrokProvider.
   *
   * @example
   * ```typescript
   * const grok = GrokProvider.new('https://api.groq.com/openai', 'sk-xxxxxxxx');
   * ```
   */
  static new(baseUrl?: string, apiKey: string = ''): GroqProvider {
    return new GroqProvider(baseUrl, apiKey);
  }

  /** @inheritdoc */
  protected jsonToModel(m: unknown): InferenceApiModel {
    const model = m as GroqModel;

    return {
      id: model.id,
      name: `${model.owned_by}: ${model.id}`,
      created: model.created,
    };
  }
}
