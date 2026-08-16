import { afterEach, describe, expect, it, vi } from 'vitest';
import { BaseOpenAIProvider } from './BaseOpenAIProvider';
import { GoogleProvider } from './GoogleProvider';

const GEMINI_BASE = 'https://generativelanguage.googleapis.com/v1beta/openai';

afterEach(() => {
  vi.unstubAllGlobals();
});

function captureUrl(body: unknown = { data: [] }) {
  const fetchMock = vi.fn().mockResolvedValue(
    new Response(JSON.stringify(body), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    })
  );
  vi.stubGlobal('fetch', fetchMock);
  return fetchMock;
}

describe('where Gemini requests are sent', () => {
  it('lists models directly under the base url', async () => {
    const fetchMock = captureUrl();

    await GoogleProvider.new(GEMINI_BASE, 'key').getModels();

    // The compatible surface is mounted on the base url itself, so an extra
    // /v1 segment gives a 404 and the provider can do nothing at all.
    expect(fetchMock.mock.calls[0][0]).toBe(`${GEMINI_BASE}/models`);
  });

  it('posts completions directly under the base url', async () => {
    const fetchMock = captureUrl();

    await GoogleProvider.new(GEMINI_BASE, 'key').postChatCompletions(
      'gemini-2.0-flash',
      [],
      new AbortController().signal
    );

    expect(fetchMock.mock.calls[0][0]).toBe(`${GEMINI_BASE}/chat/completions`);
  });

  it('reads the display name Gemini returns', async () => {
    captureUrl({
      data: [
        { id: 'models/gemini-2.0-flash', display_name: 'Gemini 2.0 Flash' },
      ],
    });

    const models = await GoogleProvider.new(GEMINI_BASE, 'key').getModels();

    expect(models).toEqual([
      { id: 'models/gemini-2.0-flash', name: 'Gemini 2.0 Flash' },
    ]);
  });
});

describe('where ordinary OpenAI-compatible requests are sent', () => {
  it('keeps the /v1 prefix for providers that use it', async () => {
    const fetchMock = captureUrl();

    await BaseOpenAIProvider.new('https://api.example.com', 'key').getModels();

    expect(fetchMock.mock.calls[0][0]).toBe(
      'https://api.example.com/v1/models'
    );
  });
});
