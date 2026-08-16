import { afterEach, describe, expect, it, vi } from 'vitest';
import { BaseOpenAIProvider } from './BaseOpenAIProvider';

const provider = () => BaseOpenAIProvider.new('http://localhost:8080', 'key');

function respondWith(body: unknown, status = 200) {
  return vi.fn().mockResolvedValue(
    new Response(JSON.stringify(body), {
      status,
      headers: { 'Content-Type': 'application/json' },
    })
  );
}

function rejectWith(name: string, message = 'boom') {
  const err = new Error(message);
  err.name = name;
  return vi.fn().mockRejectedValue(err);
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('listing models', () => {
  it('returns the models the server reported', async () => {
    vi.stubGlobal('fetch', respondWith({ data: [{ id: 'llama3' }] }));

    const models = await provider().getModels();

    expect(models).toEqual([{ id: 'llama3', name: 'llama3' }]);
  });

  it('sorts newest first, falling back to name', async () => {
    vi.stubGlobal(
      'fetch',
      respondWith({
        data: [
          { id: 'b', created: 1 },
          { id: 'a', created: 2 },
          { id: 'c' },
          { id: 'a2' },
        ],
      })
    );

    const models = await provider().getModels();

    expect(models.map((m) => m.id)).toEqual(['a', 'b', 'a2', 'c']);
  });

  it('sends the api key as a bearer token', async () => {
    const fetchMock = respondWith({ data: [] });
    vi.stubGlobal('fetch', fetchMock);

    await provider().getModels();

    const headers = fetchMock.mock.calls[0][1].headers;
    expect(headers.Authorization).toBe('Bearer key');
  });

  it('omits the header when no key is configured', async () => {
    const fetchMock = respondWith({ data: [] });
    vi.stubGlobal('fetch', fetchMock);

    await BaseOpenAIProvider.new('http://localhost:8080').getModels();

    expect(fetchMock.mock.calls[0][1].headers.Authorization).toBeUndefined();
  });

  it('allows a remote provider longer than a second to answer', async () => {
    vi.stubGlobal('fetch', respondWith({ data: [] }));
    const timeout = vi.spyOn(AbortSignal, 'timeout');

    await provider().getModels();

    // A one second budget suited a local server but was routinely too short
    // for the hosted providers the app ships with, leaving the list empty.
    expect(timeout).toHaveBeenCalledWith(expect.any(Number));
    expect(timeout.mock.calls[0][0]).toBeGreaterThanOrEqual(5000);
    timeout.mockRestore();
  });
});

describe('reporting why a request failed', () => {
  it('says so when the server did not answer in time', async () => {
    vi.stubGlobal('fetch', rejectWith('TimeoutError'));

    await expect(provider().getModels()).rejects.toThrow(/Timed out/);
  });

  it('says so when the server cannot be reached', async () => {
    vi.stubGlobal('fetch', rejectWith('TypeError', 'Failed to fetch'));

    await expect(provider().getModels()).rejects.toThrow(/Cannot reach/);
  });

  it('passes a deliberate cancellation through unchanged', async () => {
    // chat state recognises a user pressing stop by this name; wrapping it
    // would turn a deliberate stop into an error toast.
    vi.stubGlobal('fetch', rejectWith('AbortError'));

    await expect(
      provider().postChatCompletions('m', [], new AbortController().signal)
    ).rejects.toMatchObject({ name: 'AbortError' });
  });

  it('maps an unauthorised response to a readable message', async () => {
    vi.stubGlobal('fetch', respondWith({}, 401));

    await expect(provider().getModels()).rejects.toThrow(/Unauthorized/);
  });

  it('maps a rate limit to a readable message', async () => {
    vi.stubGlobal('fetch', respondWith({}, 429));

    await expect(provider().getModels()).rejects.toThrow(/Too many requests/);
  });
});

describe('caching the model list', () => {
  it('does not refetch while the cache is warm', async () => {
    const fetchMock = respondWith({ data: [{ id: 'llama3' }] });
    vi.stubGlobal('fetch', fetchMock);
    const p = provider();

    await p.getModels();
    await p.getModels();

    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});
