import { InferenceProvider } from '../../types';
import { BaseOpenAIProvider } from './BaseOpenAIProvider';
import { GoogleProvider } from './GoogleProvider';
import { GroqProvider } from './GroqProvider';
import { LlamaCppProvider } from './LlamaCppProvider';
import { MistralProvider } from './MistralProvider';
import { NvidiaNimProvider } from './NvidiaNimProvider';
import { OpenRouterProvider } from './OpenRouterProvider';

type ProviderFactoryFunction = (
  baseUrl?: string,
  apiKey?: string
) => InferenceProvider;

const PROVIDER_CACHE = new Map<string, InferenceProvider>();

// Registry mapping provider keys to their factory functions
const PROVIDER_REGISTRY: Record<string, ProviderFactoryFunction> = {
  'llama-cpp': LlamaCppProvider.new,
  'open-router': OpenRouterProvider.new,
  google: GoogleProvider.new,
  groq: GroqProvider.new,
  mistral: MistralProvider.new,
  nvidia: NvidiaNimProvider.new,
};

/**
 * Registers a new provider factory function for a given key.
 * This allows dynamic extension of available providers without modifying core code.
 *
 * @param key The unique key identifying the provider (e.g. 'anthropic')
 * @param factory The factory function to create instances of the provider
 */
export function registerProvider(
  key: string,
  factory: ProviderFactoryFunction
): void {
  PROVIDER_REGISTRY[key] = factory;
}

export function getInferenceProvider(
  key: string,
  baseUrl: string,
  apiKey: string = ''
): InferenceProvider {
  if (!baseUrl) throw new Error(`Base URL is not specified`);

  const cacheKey = `${key}-${baseUrl}`;
  if (PROVIDER_CACHE.has(cacheKey)) {
    const provider = PROVIDER_CACHE.get(cacheKey)!;
    if (provider.getApiKey() === apiKey) {
      return provider;
    }
  }

  // Look up factory from registry, default to BaseOpenAIProvider
  const factory = PROVIDER_REGISTRY[key] || BaseOpenAIProvider.new;
  const provider = factory(baseUrl, apiKey);

  PROVIDER_CACHE.set(cacheKey, provider);
  return provider;
}
