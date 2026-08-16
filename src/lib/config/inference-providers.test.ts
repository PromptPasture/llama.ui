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
    // Verified against each vendor's own documentation.
    ['openai', 'https://api.openai.com/v1/chat/completions'],
    ['groq', 'https://api.groq.com/openai/v1/chat/completions'],
    ['open-router', 'https://openrouter.ai/api/v1/chat/completions'],
    [
      'qwen',
      'https://dashscope.aliyuncs.com/compatible-mode/v1/chat/completions',
    ],
    // Cohere mounts its compatibility surface under /compatibility, so the
    // bare host produced https://api.cohere.ai/v1/chat/completions and 404ed.
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
