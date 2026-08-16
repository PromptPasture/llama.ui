import { isDev } from '../../config';
import { InferenceApiModel, Modality } from '../../types';
import { normalizeUrl } from '../../utils/url-helpers';
import { describeNetworkFailure, PROVIDER_TIMEOUT_MS } from '../response-utils';
import { SelfHostedOpenAIProvider } from './SelfHostedOpenAIProvider';

/**
 * Interface representing server properties from a Llama.cpp server instance.
 * Contains essential information about the server configuration and capabilities. [[9]]
 */
interface LlamaCppServerProps {
  /** Build information of the server */
  build_info: string;
  /** Currently loaded model name/path */
  model_path: string;
  /** Maximum context length supported by the model */
  n_ctx: number;
  /** Modality support information for the model */
  modalities?: {
    /** Whether vision capabilities are supported */
    vision: boolean;
    /** Whether audio capabilities are supported */
    audio: boolean;
  };
}

/**
 * Parses a model identifier string to extract a clean, human-readable model name.
 *
 * Strips directory paths, file extensions, and optional quantization suffixes (e.g., `.Q4_K_M`, `.gguf`)
 * from the full model path to produce a concise model name suitable for UI display.
 *
 * @param model - The full model path or identifier (e.g., `"models/llama-3-8b.Q4_K_M.gguf"`)
 * @returns A cleaned model name (e.g., `"llama-3-8b"`), or the original string if parsing fails
 *
 * @example
 * ```ts
 * parseLlamaCppModelName("models/llama-3-8b.Q4_K_M.gguf") // => "llama-3-8b"
 * parseLlamaCppModelName("/home/user/llama-7b")           // => "llama-7b"
 * parseLlamaCppModelName("Llama-3.2-3B-Instruct-Q8_0.gguf") // => "Llama-3.2-3B-Instruct"
 * parseLlamaCppModelName("unknown-model")                 // => "unknown-model"
 * ```
 *
 * @internal Used internally by {@link LlamaCppProvider} to normalize model IDs.
 */
export function parseLlamaCppModelName(model: string): string {
  const file = model.split(/[\\/]/).pop() ?? '';
  if (!file) return model;

  // Weight file extensions, then a trailing quantization tag such as Q4_K_M,
  // q4_0, IQ3_XS, fp16 or bf16. Anchoring on the tag rather than on "any
  // trailing hyphenated word" is what keeps a size like -7b or -3-8b intact.
  const name = file
    .replace(/\.(gguf|bin|safetensors|pt|pth)$/i, '')
    .replace(/[-._](?:i?q\d+[_a-z0-9]*|f?p?(?:16|32)|bf16)$/i, '');

  return name || model;
}

/**
 * Provider implementation for interacting with Llama.cpp HTTP servers.
 *
 * Extends {@link SelfHostedOpenAIProvider} to adapt OpenAI-compatible API calls to the Llama.cpp server
 * endpoint structure. Dynamically infers model capabilities (text, image, audio) from server `/props`
 * endpoint and normalizes model names for consistent display.
 *
 * @remarks
 * - This provider assumes the Llama.cpp server is running with the `--host` and `--port` flags enabled.
 * - The `/props` endpoint must be available (enabled via `--api-props` flag in llama.cpp server).
 * - Supports dynamic model capability detection (vision/audio) via `modalities` in server response.
 * - In development mode (`isDev === true`), server properties are logged to console for debugging.
 *
 * @see https://github.com/ggml-org/llama.cpp/tree/master/tools/server
 * @see {@link LlamaCppServerProps} for server response structure
 * @see {@link SelfHostedOpenAIProvider} for inherited OpenAI-compatible behavior
 *
 * @extends SelfHostedOpenAIProvider
 */
export class LlamaCppProvider extends SelfHostedOpenAIProvider {
  /**
   * Cached server properties retrieved from the Llama.cpp server.
   * Populated on first call to {@link getServerProps}.
   * Undefined until the server is successfully queried.
   *
   * @internal Used to avoid repeated server calls and to enrich model metadata.
   */
  private serverProps?: LlamaCppServerProps;

  /**
   * Creates a new instance of {@link LlamaCppProvider}.
   *
   * @param baseUrl - Base URL of the Llama.cpp server (e.g., `"http://localhost:8080"`)
   * @param apiKey - API key for authentication (optional; typically not used with local Llama.cpp servers)
   * @returns A new configured LlamaCppProvider instance
   *
   * @example
   * ```ts
   * const provider = LlamaCppProvider.new("http://localhost:8080");
   * ```
   */
  static new(baseUrl?: string, apiKey: string = ''): LlamaCppProvider {
    return new LlamaCppProvider(baseUrl, apiKey);
  }

  /** @inheritdoc */
  async getModels(): Promise<InferenceApiModel[]> {
    // The properties say whether the model takes images or audio as well as
    // text, and a server need not offer them — they are behind a flag, and a
    // proxy may not pass them through. Not knowing costs a little detail;
    // refusing to list any models at all, which is what a failure here used to
    // do, costs the whole picker.
    try {
      await this.getServerProps();
    } catch (error) {
      if (isDev)
        console.debug('llama.cpp server properties unavailable:', error);
    }

    return super.getModels();
  }

  /** @inheritdoc */
  protected getDefaultChatParams(): Record<string, unknown> {
    return {
      ...super.getDefaultChatParams(),
      cache_prompt: true,
      timings_per_token: true,
    };
  }

  /** @inheritdoc */
  protected jsonToModel(m: unknown): InferenceApiModel {
    const model = m as InferenceApiModel;
    const modalities: Modality[] = ['text'];

    if (this.serverProps?.modalities?.audio) modalities.push('audio');
    if (this.serverProps?.modalities?.vision) modalities.push('image');

    return {
      id: model.id,
      name: parseLlamaCppModelName(model.id),
      created: model.created,
      description: model.description,
      modalities,
    };
  }

  /**
   * Fetches and caches server properties from the Llama.cpp server’s `/props` endpoint.
   *
   * This method is called automatically before model retrieval to ensure accurate metadata.
   * Includes timeout protection and graceful failure handling.
   *
   * @returns Promise resolving to the server properties object
   * @throws {Error} If the server returns a non-OK HTTP status or the request fails
   *
   * @example
   * Server response example:
   * ```json
   * {
   *   "build_info": "llama.cpp v1.2.3 (build: 2024-05-10)",
   *   "model_path": "models/llava-v1.5-7b.Q4_K_M.gguf",
   *   "n_ctx": 4096,
   *   "modalities": {
   *     "vision": true,
   *     "audio": false
   *   }
   * }
   * ```
   *
   * @internal Used internally by {@link getModels} and {@link jsonToModel}.
   */
  private async getServerProps(): Promise<LlamaCppServerProps> {
    let fetchResponse: Response;
    try {
      fetchResponse = await fetch(normalizeUrl('/props', this.getBaseUrl()), {
        headers: this.getHeaders(),
        signal: AbortSignal.timeout(PROVIDER_TIMEOUT_MS),
      });
    } catch (error) {
      throw describeNetworkFailure(error);
    }

    await this.isErrorResponse(fetchResponse);

    const data = await fetchResponse.json();
    if (isDev) console.debug('server props:\n', JSON.stringify(data, null, 2));

    // Cache normalized server properties
    this.serverProps = {
      build_info: data.build_info,
      model_path: parseLlamaCppModelName(data?.model_path ?? ''),
      n_ctx: data.n_ctx,
      modalities: data?.modalities,
    };

    return this.serverProps;
  }
}
