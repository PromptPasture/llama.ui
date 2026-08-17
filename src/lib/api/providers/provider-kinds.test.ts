import { afterEach, describe, expect, it, vi } from 'vitest';
import { CloudOpenAIProvider } from './CloudOpenAIProvider';
import { GoogleProvider } from './GoogleProvider';
import { GroqProvider } from './GroqProvider';
import { LlamaCppProvider } from './LlamaCppProvider';
import { MistralProvider } from './MistralProvider';
import { NvidiaNimProvider } from './NvidiaNimProvider';
import { OpenRouterProvider } from './OpenRouterProvider';
import { SelfHostedOpenAIProvider } from './SelfHostedOpenAIProvider';

const URL = 'http://localhost:8080';

/** A fresh Response per call: a body can only be read once. */
function respondWith(body: unknown) {
  return vi.fn().mockImplementation(
    () =>
      new Response(JSON.stringify(body), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      })
  );
}

afterEach(() => {
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

/**
 * top_k, min_p, repeat_penalty, dry_multiplier, samplers and the rest are
 * llama.cpp's. Sent where they are not understood they are rejected as
 * unrecognised; not sent where they are, every one of those controls in the
 * settings silently does nothing. Which is which is a decision per provider,
 * so it is written down per provider.
 */
const SAMPLING: [
  string,
  () => { acceptsGenerationOptions(): boolean },
  boolean,
][] = [
  ['llama.cpp', () => LlamaCppProvider.new(URL), true],
  // Routes to backends that take them, and documents them itself.
  ['OpenRouter', () => OpenRouterProvider.new(URL), true],
  ['Google', () => GoogleProvider.new(URL), false],
  ['Groq', () => GroqProvider.new(URL), false],
  ['Mistral', () => MistralProvider.new(URL), false],
  ['NVIDIA NIM', () => NvidiaNimProvider.new(URL), false],
];

describe('which providers are sent llama.cpp own sampling options', () => {
  for (const [name, make, expected] of SAMPLING) {
    it(`${expected ? 'sends them to' : 'keeps them from'} ${name}`, () => {
      expect(make().acceptsGenerationOptions()).toBe(expected);
    });
  }

  it('follows from the kind of server, for anything built on the two kinds', () => {
    expect(SelfHostedOpenAIProvider.new(URL).acceptsGenerationOptions()).toBe(
      true
    );
    expect(CloudOpenAIProvider.new(URL).acceptsGenerationOptions()).toBe(false);
  });
});

describe('what each factory actually builds', () => {
  /**
   * The inherited factory names the base class, so a subclass without one of
   * its own hands back a base provider: the wrong expiry, and the wrong
   * answer about sampling options, with nothing to say so.
   */
  const CLASSES = [
    [
      'self-hosted',
      () => SelfHostedOpenAIProvider.new(URL),
      SelfHostedOpenAIProvider,
    ],
    ['cloud', () => CloudOpenAIProvider.new(URL), CloudOpenAIProvider],
    ['llama.cpp', () => LlamaCppProvider.new(URL), LlamaCppProvider],
    ['Google', () => GoogleProvider.new(URL), GoogleProvider],
    ['Groq', () => GroqProvider.new(URL), GroqProvider],
    ['Mistral', () => MistralProvider.new(URL), MistralProvider],
    ['NVIDIA NIM', () => NvidiaNimProvider.new(URL), NvidiaNimProvider],
    ['OpenRouter', () => OpenRouterProvider.new(URL), OpenRouterProvider],
  ] as const;

  for (const [name, make, expected] of CLASSES) {
    it(`builds a ${name} provider, not the one it inherits from`, () => {
      expect(make()).toBeInstanceOf(expected);
    });
  }
});

describe('how long each kind holds on to a model list', () => {
  async function asksAgainAfter(
    provider: { getModels(): Promise<unknown> },
    elapsedMs: number
  ) {
    const fetched = respondWith({ data: [{ id: 'a-model' }] });
    vi.stubGlobal('fetch', fetched);
    await provider.getModels();

    vi.useFakeTimers();
    vi.setSystemTime(Date.now() + elapsedMs);
    await provider.getModels();

    return fetched.mock.calls.length > 1;
  }

  it('asks a self-hosted server again within the minute', async () => {
    // It is the reader's own machine, and they change what is loaded on it.
    expect(
      await asksAgainAfter(SelfHostedOpenAIProvider.new(URL), 61_000)
    ).toBe(true);
  });

  it('holds a self-hosted list for a little while', async () => {
    expect(
      await asksAgainAfter(SelfHostedOpenAIProvider.new(URL), 30_000)
    ).toBe(false);
  });

  it('holds a hosted list far longer', async () => {
    // A hosted catalogue changes when the company changes it, not when the
    // reader does something.
    expect(
      await asksAgainAfter(CloudOpenAIProvider.new(URL), 10 * 60_000)
    ).toBe(false);
  });

  it('asks a hosted provider again eventually', async () => {
    expect(
      await asksAgainAfter(CloudOpenAIProvider.new(URL), 16 * 60_000)
    ).toBe(true);
  });
});
