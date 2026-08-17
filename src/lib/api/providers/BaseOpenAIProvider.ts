import { isDev } from '../../config';
import {
  ChatCompletionProvider,
  InferenceApiMessage,
  InferenceApiModel,
  LLMProvider,
  ModelProvider,
  SSEChatCompletionMessage,
} from '../../types';
import { normalizeUrl } from '../../utils/url-helpers';
import {
  describeNetworkFailure,
  errorDetail,
  PROVIDER_TIMEOUT_MS,
} from '../response-utils';
import { processSSEStream } from '../sse-parser';

/**
 * What each HTTP status means, as a short name and a description to fall back
 * on when the server did not explain itself.
 */
const HTTP_ERRORS: Readonly<Record<number, readonly [string, string]>> = {
  400: ['Bad request', 'Invalid parameters or malformed input'],
  401: ['Unauthorized', 'Invalid or missing API key'],
  402: ['Payment required', 'Quota exceeded or subscription needed'],
  403: ['Forbidden', 'Access denied'],
  404: ['Not found', 'The requested endpoint or model does not exist'],
  429: ['Too many requests', 'Rate limit exceeded'],
  444: ['No response', 'Server closed connection without response'],
  500: ['Internal server error', 'Please try again later'],
  502: ['Bad gateway', 'Backend service is unavailable'],
  503: ['Service unavailable', 'Server is temporarily down'],
  504: ['Gateway timeout', 'Backend took too long to respond'],
};

/**
 * Base implementation for OpenAI-compatible API providers.
 *
 * This class provides a foundational implementation for interacting with
 * OpenAI-compatible inference APIs (e.g., Ollama, vLLM, LocalAI) that expose
 * `/v1/models` and `/v1/chat/completions` endpoints.
 *
 * It handles:
 * - Authentication via Bearer token
 * - Model list caching with expiration
 * - Error response parsing and throwing
 * - Streaming chat completion via Server-Sent Events (SSE)
 * - Header normalization and URL sanitization
 *
 * @example
 * ```ts
 * const provider = BaseOpenAIProvider.new('http://localhost:11434', 'sk-...');
 * const models = await provider.getModels();
 * const stream = await provider.postChatCompletions(
 *   'llama3',
 *   [{ role: 'user', content: 'Hello!' }],
 *   abortSignal
 * );
 * ```
 */
export class BaseOpenAIProvider
  implements LLMProvider, ModelProvider, ChatCompletionProvider
{
  /**
   * The base URL of the OpenAI-compatible API endpoint.
   * @internal
   */
  private baseUrl: string;

  /**
   * The API key used for authentication.
   * @internal
   */
  private apiKey: string;

  /**
   * Cached list of available models fetched from the API.
   * @internal
   */
  private models: InferenceApiModel[] = [];

  /**
   * Timestamp of the last successful model list fetch.
   * Used to determine cache expiration (5 minutes).
   * @internal
   */
  protected lastUpdated: number;

  /**
   * Constructs a new BaseOpenAIProvider instance.
   *
   * @param baseUrl - The base URL of the API endpoint (e.g., `http://localhost:11434`)
   * @param apiKey - Optional API key for authentication (Bearer token)
   * @throws {Error} If `baseUrl` is not provided or is empty
   *
   * @protected
   */
  protected constructor(baseUrl?: string, apiKey: string = '') {
    if (!baseUrl) throw new Error(`Base URL is not specified`);
    this.baseUrl = baseUrl;
    this.apiKey = apiKey;
    this.lastUpdated = Date.now();
  }

  /**
   * Factory method to create a new provider instance.
   *
   * Every subclass declares its own, because this one names its own class:
   * inheriting it hands back a base provider instead of the subclass, with
   * the wrong expiry and none of the sampling options a self-hosted server
   * understands. It cannot build `this` instead — the factory passes this
   * method around as a bare function, which leaves `this` behind.
   *
   * @param baseUrl - The base URL of the API endpoint
   * @param apiKey - Optional API key for authentication
   * @returns A new instance of BaseOpenAIProvider
   *
   * @static
   */
  static new(baseUrl?: string, apiKey: string = '') {
    return new BaseOpenAIProvider(baseUrl, apiKey);
  }

  /**
   * Retrieves the list of available models from the API.
   *
   * Uses cached models if available and not expired (cached for 5 minutes).
   * If cache is expired or empty, fetches fresh data from `/v1/models`.
   *
   * @returns Promise resolving to an array of `InferenceApiModel` objects
   * @throws {Error} If the API returns a non-200 status or malformed response
   *
   * @example
   * ```ts
   * const models = await provider.getModels();
   * console.log(models.map(m => m.id)); // ["llama3", "mistral", ...]
   * ```
   *
   * @see {@link getBaseUrl}
   * @see {@link jsonToModels}
   */
  async getModels(options?: { force?: boolean }): Promise<InferenceApiModel[]> {
    if (isDev) console.debug('v1Models', this.models);

    // Asked outright — the Fetch Models button — the answer has to come from
    // the server. Someone who has just loaded a different model is asking
    // whether it is there, and the list held here says it is not.
    if (!options?.force && this.models.length > 0 && !this.isExpired()) {
      return this.models;
    }

    let fetchResponse: Response;
    try {
      fetchResponse = await fetch(
        normalizeUrl(this.getModelsPath(), this.getBaseUrl()),
        {
          method: 'GET',
          headers: this.getHeaders(),
          signal: AbortSignal.timeout(PROVIDER_TIMEOUT_MS),
        }
      );
    } catch (error) {
      throw describeNetworkFailure(error);
    }
    await this.isErrorResponse(fetchResponse);
    const json = await fetchResponse.json();

    // A server can answer 200 and still be refusing: llama.cpp and LM Studio
    // both reply to an unknown path with an error in the body and an ordinary
    // status. Read as a model list that came back empty, a mistyped address
    // left the picker blank with nothing said, while the server had named the
    // path it did not recognise.
    if (!Array.isArray(json?.data)) {
      throw new Error(
        errorDetail(json) || 'The server did not answer with a list of models.'
      );
    }

    this.models = this.jsonToModels(json.data);

    if (this.models.length > 0) this.lastUpdated = Date.now();

    return this.models;
  }

  /**
   * Sends a chat completion request to the API with streaming support.
   *
   * Accepts a model name, message history, abort signal, and optional custom parameters.
   * Returns a streaming response via Server-Sent Events (SSE).
   *
   * @param model - The model identifier to use for completion (e.g., "llama3")
   * @param messages - Array of conversation messages following OpenAI format
   * @param abortSignal - AbortSignal to cancel the request if needed
   * @param customOptions - Optional override parameters for generation (e.g., temperature, max_tokens)
   * @returns Async generator yielding SSE events (chat completion tokens)
   * @throws {Error} If the API returns a non-200 status or malformed response
   *
   * @remarks
   * Default parameters include:
   * - `stream: true`
   *
   * Custom options are merged into the request body. Be cautious: invalid parameters
   * may cause API errors.
   *
   * @example
   * ```ts
   * const stream = await provider.postChatCompletions(
   *   'llama3',
   *   [{ role: 'user', content: 'Tell me a joke.' }],
   *   abortController.signal,
   *   { temperature: 0.7, max_tokens: 100 }
   * );
   * for await (const chunk of stream) {
   *   console.log(chunk.content);
   * }
   * ```
   *
   * @see {@link processSSEStream}
   * @see {@link getDefaultChatParams}
   * @see {@link isAllowCustomOptions}
   */
  async postChatCompletions(
    model: string,
    messages: readonly InferenceApiMessage[],
    abortSignal: AbortSignal,
    customOptions?: object
  ) {
    if (isDev) console.debug('v1ChatCompletions', { messages });

    // Prepare default parameters
    let params: Record<string, unknown> = {
      model,
      messages,
      ...this.getDefaultChatParams(),
    };

    // Merge custom options if provided
    if (
      this.isAllowCustomOptions() &&
      customOptions &&
      typeof customOptions === 'object'
    ) {
      params = { ...params, ...customOptions };
    }

    // Send request
    let fetchResponse: Response;
    try {
      fetchResponse = await fetch(
        normalizeUrl(this.getChatCompletionsPath(), this.getBaseUrl()),
        {
          method: 'POST',
          headers: this.getHeaders(),
          body: JSON.stringify(params),
          signal: abortSignal,
        }
      );
    } catch (error) {
      throw describeNetworkFailure(error);
    }

    await this.isErrorResponse(fetchResponse);
    return processSSEStream<SSEChatCompletionMessage>(fetchResponse);
  }

  /**
   * Generates HTTP headers for API requests, including authentication.
   *
   * Includes:
   * - `Content-Type: application/json`
   * - `Authorization: Bearer <apiKey>` if API key is provided
   *
   * @returns Headers configuration suitable for `fetch` requests
   *
   * @protected
   */
  protected getHeaders(): HeadersInit {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };

    const apiKey = this.getApiKey();
    if (apiKey) {
      headers.Authorization = `Bearer ${apiKey}`;
    }

    return headers;
  }

  /**
   * Validates the HTTP response and throws an appropriate error if status is not 200.
   *
   * Attempts to parse response body as JSON for detailed error messages.
   * Logs errors to console in development mode.
   *
   * @param response - The HTTP response object from fetch
   * @throws {Error} With specific message based on HTTP status code or API error body
   *
   * @protected
   */
  protected async isErrorResponse(response: Response): Promise<void> {
    if (response.status === 200) return;

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let body: any = {};
    try {
      body = await response.json();
    } catch (e) {
      // Fallback if response is not JSON (e.g., plain text or empty)
      console.warn('Non-JSON response received:', e);
    }

    if (Object.keys(body).length > 0) {
      console.error('API error response:', body);
    }

    const [name, generic] = HTTP_ERRORS[response.status] ?? [
      'Unknown error',
      `HTTP ${response.status}`,
    ];
    // What the server said about this particular request beats anything that
    // can be inferred from the status alone: which model is missing, which
    // parameter is out of range, how far over the context limit the request
    // was. Falls back to the description of the status when it said nothing.
    throw new Error(`${name}: ${errorDetail(body) || generic}`);
  }

  /**
   * Determines whether the cached model list has expired.
   *
   * Cache expires after 5 minutes to ensure freshness.
   *
   * @returns `true` if the cache is expired, `false` otherwise
   *
   * @protected
   */
  protected isExpired(): boolean {
    return Date.now() - this.lastUpdated > 5 * 60 * 1000;
  }

  /**
   * Indicates whether custom generation options (e.g., temperature, max_tokens) are allowed.
   *
   * Override in subclasses to enable support.
   *
   * @returns `false` by default
   *
   * @protected
   */
  protected isAllowCustomOptions(): boolean {
    return false;
  }

  /** @inheritdoc */
  acceptsGenerationOptions(): boolean {
    return this.isAllowCustomOptions();
  }

  /**
   * Path of the model listing endpoint, relative to the base URL.
   *
   * Override where a provider's OpenAI-compatible surface is not mounted under
   * `/v1` — Google's, for instance, sits directly under `/v1beta/openai`.
   *
   * @returns The path to request.
   * @protected
   */
  protected getModelsPath(): string {
    return '/v1/models';
  }

  /**
   * Path of the chat completions endpoint, relative to the base URL.
   *
   * @returns The path to request.
   * @protected
   */
  protected getChatCompletionsPath(): string {
    return '/v1/chat/completions';
  }

  protected getDefaultChatParams(): Record<string, unknown> {
    // Token counts are not sent unless they are asked for. llama.cpp reports
    // its own timings regardless; everything else answered the performance
    // metrics with nothing at all.
    return { stream: true, stream_options: { include_usage: true } };
  }

  /**
   * Converts raw JSON data from `/v1/models` into an array of `InferenceApiModel` objects.
   *
   * Filters invalid entries and sorts models by creation time (descending) or name.
   *
   * @param data - Raw JSON array from API response (`data` field of `/v1/models`)
   * @returns Sorted array of `InferenceApiModel` objects
   *
   * @protected
   */
  protected jsonToModels(data: unknown[]): InferenceApiModel[] {
    const res: InferenceApiModel[] = [];
    if (data && Array.isArray(data)) {
      // Listed once each. A server that repeats an id — Mistral has been seen
      // to — gave the picker two entries under the same name, and a list keyed
      // by it cannot be rendered at all, so the picker showed nothing.
      const seen = new Set<string>();
      for (const m of data) {
        const model = this.jsonToModel(m);
        if (seen.has(model.id)) continue;
        seen.add(model.id);
        res.push(model);
      }
      res.sort(this.compareModels);
    }
    return res;
  }

  /**
   * Converts a single JSON model object into an `InferenceApiModel`.
   *
   * This is a passthrough by default. Override in subclasses for provider-specific parsing.
   *
   * @param m - Raw model data from API response
   * @returns A validated `InferenceApiModel` object
   *
   * @protected
   */
  protected jsonToModel(m: unknown): InferenceApiModel {
    const model = m as InferenceApiModel;
    return {
      ...model,
      name: model.name || model.id,
    };
  }

  /**
   * Compares two models for sorting.
   *
   * Sorts by `created` timestamp (descending) if available; otherwise by `name` (ascending).
   *
   * @param a - First model to compare
   * @param b - Second model to compare
   * @returns Negative, zero, or positive value for sorting order
   *
   * @protected
   */
  protected compareModels(a: InferenceApiModel, b: InferenceApiModel): number {
    const aCreated = a.created ?? 0;
    const bCreated = b.created ?? 0;

    if (aCreated !== bCreated) {
      return bCreated - aCreated; // Newest first
    }

    return a.name.localeCompare(b.name); // Alphabetical fallback
  }

  /**
   * Returns the base URL configured for this provider.
   *
   * @returns The base URL of the API endpoint
   */
  getBaseUrl(): string {
    return this.baseUrl;
  }

  /**
   * Returns the API key configured for authentication.
   *
   * @returns The Bearer token used for API requests
   */
  getApiKey(): string {
    return this.apiKey;
  }
}
