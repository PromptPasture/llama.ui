import { afterEach, describe, expect, it, vi } from 'vitest';
import { BaseOpenAIProvider } from './BaseOpenAIProvider';

const provider = () => BaseOpenAIProvider.new('http://localhost:8080', 'key');

/** A fresh Response per call: a body can only be read once, so a shared one
 * fails the moment a test fetches twice. */
function respondWith(body: unknown, status = 200) {
  return vi.fn().mockImplementation(
    () =>
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
  vi.useRealTimers();
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

describe('repeating what the server said went wrong', () => {
  it('prefers the server explanation to the description of the status', async () => {
    vi.stubGlobal(
      'fetch',
      respondWith(
        { error: { message: 'This model requires a verified organization' } },
        403
      )
    );

    // 'Forbidden: Access denied' tells the reader nothing they can act on.
    await expect(provider().getModels()).rejects.toThrow(
      'Forbidden: This model requires a verified organization'
    );
  });

  it('carries the detail a bad request came back with', async () => {
    vi.stubGlobal(
      'fetch',
      respondWith(
        {
          error: {
            message:
              'the request exceeds the available context size: 8192 > 4096',
          },
        },
        400
      )
    );

    await expect(provider().getModels()).rejects.toThrow(/8192 > 4096/);
  });

  it('accepts an error given as a plain string', async () => {
    // Not every OpenAI-compatible server nests it under `message`.
    vi.stubGlobal('fetch', respondWith({ error: 'model not loaded' }, 500));

    await expect(provider().getModels()).rejects.toThrow(
      'Internal server error: model not loaded'
    );
  });

  it('accepts an error given at the top level', async () => {
    vi.stubGlobal('fetch', respondWith({ message: 'no slots available' }, 503));

    await expect(provider().getModels()).rejects.toThrow(
      'Service unavailable: no slots available'
    );
  });

  it('still describes the status when the server said nothing', async () => {
    vi.stubGlobal('fetch', respondWith({}, 401));

    await expect(provider().getModels()).rejects.toThrow(
      'Unauthorized: Invalid or missing API key'
    );
  });

  it('ignores an explanation that is only whitespace', async () => {
    vi.stubGlobal('fetch', respondWith({ error: { message: '   ' } }, 404));

    await expect(provider().getModels()).rejects.toThrow(
      'Not found: The requested endpoint or model does not exist'
    );
  });

  it('names a status it has no description for', async () => {
    vi.stubGlobal('fetch', respondWith({}, 418));

    await expect(provider().getModels()).rejects.toThrow(
      'Unknown error: HTTP 418'
    );
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

describe('asking again for the list of models', () => {
  it('answers from what it already has', async () => {
    const fetched = respondWith({ data: [{ id: 'llama3' }] });
    vi.stubGlobal('fetch', fetched);
    const p = provider();
    await p.getModels();

    await p.getModels();

    // Every keystroke in the base url asks for these; going to the server
    // each time would be a request per character.
    expect(fetched).toHaveBeenCalledTimes(1);
  });

  it('goes and looks again when asked outright', async () => {
    const fetched = respondWith({ data: [{ id: 'llama3' }] });
    vi.stubGlobal('fetch', fetched);
    const p = provider();
    await p.getModels();

    await p.getModels({ force: true });

    // Someone who has just loaded a different model and pressed Fetch Models
    // is asking the server, not the cache.
    expect(fetched).toHaveBeenCalledTimes(2);
  });

  it('reports what the second look found', async () => {
    const fetched = vi
      .fn()
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ data: [{ id: 'the-old-model' }] }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        })
      )
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ data: [{ id: 'the-new-model' }] }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        })
      );
    vi.stubGlobal('fetch', fetched);
    const p = provider();
    await p.getModels();

    const models = await p.getModels({ force: true });

    expect(models).toEqual([{ id: 'the-new-model', name: 'the-new-model' }]);
  });

  it('goes back once what it has is old enough', async () => {
    const fetched = respondWith({ data: [{ id: 'llama3' }] });
    vi.stubGlobal('fetch', fetched);
    const p = provider();
    await p.getModels();

    vi.useFakeTimers();
    vi.setSystemTime(Date.now() + 10 * 60 * 1000);
    await p.getModels();

    expect(fetched).toHaveBeenCalledTimes(2);
  });
});
