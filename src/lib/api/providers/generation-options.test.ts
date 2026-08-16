import { afterEach, describe, expect, it, vi } from 'vitest';
import { BaseOpenAIProvider } from './BaseOpenAIProvider';
import { CloudOpenAIProvider } from './CloudOpenAIProvider';
import { LlamaCppProvider } from './LlamaCppProvider';
import { SelfHostedOpenAIProvider } from './SelfHostedOpenAIProvider';

/** What configToCustomOptions produces once the override toggles are on. */
const OPTIONS = {
  temperature: 0.2,
  top_k: 40,
  min_p: 0.05,
  repeat_penalty: 1.1,
  dry_multiplier: 1.5,
};

afterEach(() => {
  vi.unstubAllGlobals();
});

async function requestBody(provider: {
  postChatCompletions: (
    m: string,
    msgs: never[],
    s: AbortSignal,
    o?: object
  ) => Promise<unknown>;
}) {
  const fetchMock = vi
    .fn()
    .mockResolvedValue(new Response('data: [DONE]\n', { status: 200 }));
  vi.stubGlobal('fetch', fetchMock);

  await provider.postChatCompletions(
    'a-model',
    [],
    new AbortController().signal,
    OPTIONS
  );

  return JSON.parse(fetchMock.mock.calls.at(-1)![1].body);
}

describe('self-hosted servers receive the generation settings', () => {
  it('forwards them to llama.cpp', async () => {
    const body = await requestBody(
      LlamaCppProvider.new('http://localhost:8080')
    );

    // These are llama.cpp's own sampling parameters, and the settings screen
    // is built around them. They used to be assembled and then discarded.
    expect(body).toMatchObject(OPTIONS);
  });

  it('still sends llama.cpp its own defaults alongside them', async () => {
    const body = await requestBody(
      LlamaCppProvider.new('http://localhost:8080')
    );

    expect(body).toMatchObject({
      stream: true,
      cache_prompt: true,
      timings_per_token: true,
    });
  });

  it('forwards them for any self-hosted server', async () => {
    class Probe extends SelfHostedOpenAIProvider {
      static override new(baseUrl?: string) {
        return new Probe(baseUrl);
      }
    }
    const body = await requestBody(Probe.new('http://localhost:9999'));

    expect(body.temperature).toBe(0.2);
  });
});

describe('hosted providers do not', () => {
  it('drops them for a plain OpenAI-compatible endpoint', async () => {
    const body = await requestBody(
      BaseOpenAIProvider.new('https://api.example.com')
    );

    // top_k, min_p and dry_multiplier are not OpenAI parameters; sending them
    // to an API that only speaks that subset is rejected as unrecognised.
    expect(body.temperature).toBeUndefined();
    expect(body.top_k).toBeUndefined();
  });

  it('drops them for a cloud provider', async () => {
    class Probe extends CloudOpenAIProvider {
      static override new(baseUrl?: string) {
        return new Probe(baseUrl);
      }
    }
    const body = await requestBody(Probe.new('https://api.example.com'));

    expect(body.temperature).toBeUndefined();
  });

  it('still sends the model and the stream flag', async () => {
    const body = await requestBody(
      BaseOpenAIProvider.new('https://api.example.com')
    );

    expect(body).toMatchObject({ model: 'a-model', stream: true });
  });
});
