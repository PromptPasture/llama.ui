import { InferenceApiModel } from '../../types';
import { CloudOpenAIProvider } from './CloudOpenAIProvider';

/**
 * Represents a model available on the NVIDIA NIM API.
 *
 * This interface mirrors the structure of models returned by NVIDIA's OpenAI-compatible API endpoint.
 */
interface NvidiaModel {
  id: string;
  object: string;
  created: number;
  owned_by: string;
  root: string;
  parent: string;
  max_model_len: number;
  permission: Permission[];
}
export interface Permission {
  id: string;
  object: string;
  created: number;
  allow_create_engine: boolean;
  allow_sampling: boolean;
  allow_logprobs: boolean;
  allow_search_indices: boolean;
  allow_view: boolean;
  allow_fine_tuning: boolean;
  organization: string;
  group: string;
  is_blocking: boolean;
}

/**
 * NVIDIA NIM provider implementation for the OpenAI-compatible API.
 *
 * Extends {@link CloudOpenAIProvider} to handle NVIDIA's model format and API endpoints.
 * Automatically converts NVIDIA model responses into the standard {@link InferenceApiModel} format.
 *
 * @see https://docs.nvidia.com/nim/large-language-models/latest/api-reference.html
 *
 * @example
 * const nvidiaProvider = NvidiaProvider.new('https://integrate.api.nvidia.com', 'your-api-key');();
 */
export class NvidiaNimProvider extends CloudOpenAIProvider {
  /**
   * Creates a new instance of the NVIDIA provider.
   *
   * @param baseUrl - Optional base URL for the NVIDIA API endpoint.
   *                  Defaults to the standard NVIDIA OpenAI-compatible endpoint if not provided.
   * @param apiKey - API key for authentication with NVIDIA's service.
   *                 Must be provided unless using a different auth mechanism.
   * @returns A new configured `NvidiaProvider` instance.
   */
  static new(baseUrl?: string, apiKey: string = ''): NvidiaNimProvider {
    return new NvidiaNimProvider(baseUrl, apiKey);
  }

  /** @inheritdoc */
  protected jsonToModel(m: unknown): InferenceApiModel {
    const model = m as NvidiaModel;

    return {
      id: model.id,
      name: model.id,
      created: model.created,
    };
  }
}
