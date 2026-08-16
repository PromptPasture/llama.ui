import { describe, expect, it } from 'vitest';
import PROVIDERS from './inference-providers.json';
import { normalizeUrl } from '../utils/url-helpers';

type Provider = { baseUrl?: string; name?: string };
const providers = PROVIDERS as Record<string, Provider>;

/** The URL the app will request, for providers that use the default /v1 paths. */
const chatUrl = (key: string) =>
  normalizeUrl('/v1/chat/completions', providers[key].baseUrl ?? '');

describe('configured base urls', () => {
  it('every provider declares one', () => {
    for (const [key, provider] of Object.entries(providers)) {
      expect(provider.baseUrl, `${key} has no baseUrl`).toBeTruthy();
    }
  });

  it('none carries a trailing slash, which would double up', () => {
    for (const [key, provider] of Object.entries(providers)) {
      expect(provider.baseUrl, `${key}`).not.toMatch(/\/$/);
    }
  });

  it.each([
    // Each of these was checked by requesting the models endpoint the app
    // builds: an unauthenticated 401, 403 or 200 means the path exists, while
    // a 404 would mean it does not.
    ['openai', 'https://api.openai.com/v1/chat/completions'],
    ['mistral', 'https://api.mistral.ai/v1/chat/completions'],
    ['deepseek', 'https://api.deepseek.com/v1/chat/completions'],
    ['groq', 'https://api.groq.com/openai/v1/chat/completions'],
    ['open-router', 'https://openrouter.ai/api/v1/chat/completions'],
    ['hugging-face', 'https://router.huggingface.co/v1/chat/completions'],
    ['nvidia', 'https://integrate.api.nvidia.com/v1/chat/completions'],
    ['perplexity', 'https://api.perplexity.ai/v1/chat/completions'],
    ['together', 'https://api.together.xyz/v1/chat/completions'],
    [
      'qwen',
      'https://dashscope.aliyuncs.com/compatible-mode/v1/chat/completions',
    ],
    // Anthropic documents its compatibility base as api.anthropic.com/v1/,
    // which is what the bare host plus the default paths produces.
    ['anthropic', 'https://api.anthropic.com/v1/chat/completions'],
    // Cohere mounts its compatibility surface under /compatibility, so the
    // bare host produced https://api.cohere.ai/v1/chat/completions. Their
    // host refuses unauthenticated requests for every path alike, so this one
    // rests on the documented base url rather than on a probe.
    ['cohere', 'https://api.cohere.ai/compatibility/v1/chat/completions'],
  ])('%s resolves to the documented endpoint', (key, expected) => {
    expect(chatUrl(key)).toBe(expected);
  });

  it('leaves google to its own paths, which are not under /v1', () => {
    // GoogleProvider overrides the endpoint paths; the base url stays as the
    // documented https://generativelanguage.googleapis.com/v1beta/openai.
    expect(providers['google'].baseUrl).toBe(
      'https://generativelanguage.googleapis.com/v1beta/openai'
    );
  });
});
