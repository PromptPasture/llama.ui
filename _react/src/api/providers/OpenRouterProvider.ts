import { InferenceApiModel, Modality } from '../../types';
import { CloudOpenAIProvider } from './CloudOpenAIProvider';

/**
 * Represents a model available via the OpenRouter API.
 *
 * @see https://openrouter.ai/docs/overview/models
 */
interface OpenRouterModel {
  id: string;
  name: string;
  created: number;
  description: string;
  architecture: Architecture;
  top_provider: TopProvider;
  pricing: Pricing;
  canonical_slug: string;
  context_length: number;
  hugging_face_id: string;
  supported_parameters: string[];
}

interface Architecture {
  input_modalities: Modality[];
  output_modalities: Modality[];
  tokenizer: string;
  instruct_type: string;
}

interface TopProvider {
  is_moderated: boolean;
  context_length: number;
  max_completion_tokens: number;
}

interface Pricing {
  prompt: string;
  completion: string;
  image: string;
  request: string;
  web_search: string;
  internal_reasoning: string;
  input_cache_read: string;
  input_cache_write: string;
}

/**
 * Provider implementation for interacting with the OpenRouter API.
 *
 * Extends `CloudOpenAIProvider` to leverage OpenAI-compatible request formatting
 * while adapting to OpenRouter-specific model metadata and endpoint structure.
 *
 * @see https://openrouter.ai/docs
 *
 * @extends CloudOpenAIProvider
 */
export class OpenRouterProvider extends CloudOpenAIProvider {
  /**
   * Creates a new instance of OpenRouterProvider with optional base URL and API key.
   *
   * @param baseUrl - Optional custom base URL for the OpenRouter API (defaults to OpenRouter's public endpoint)
   * @param apiKey - API key for authentication. Required for most endpoints.
   * @returns A new OpenRouterProvider instance
   */
  static new(baseUrl?: string, apiKey: string = ''): OpenRouterProvider {
    return new OpenRouterProvider(baseUrl, apiKey);
  }

  /** @inheritdoc */
  protected isAllowCustomOptions(): boolean {
    return true;
  }

  /** @inheritdoc */
  protected jsonToModel(m: unknown): InferenceApiModel {
    const model = m as OpenRouterModel;
    return {
      id: model.id,
      name: model.name,
      created: model.created,
      description: model.description,
      modalities: model.architecture.input_modalities || [],
      output_modalities: model.architecture.output_modalities || [],
    };
  }
}
