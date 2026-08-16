import { afterEach, describe, expect, it, vi } from 'vitest';
import { LlamaCppProvider } from './LlamaCppProvider';

afterEach(() => {
  vi.unstubAllGlobals();
});

function rejectWith(name: string, message = 'boom') {
  const err = new Error(message);
  err.name = name;
  return vi.fn().mockRejectedValue(err);
}

const provider = () => LlamaCppProvider.new('http://localhost:8080');

describe('reporting why the server properties could not be read', () => {
  it('says so when the server did not answer in time', async () => {
    vi.stubGlobal('fetch', rejectWith('TimeoutError'));

    // This used to fall through to a placeholder 444 response and report
    // "Server closed connection without response" for every kind of failure.
    await expect(provider().getModels()).rejects.toThrow(/Timed out/);
  });

  it('says so when the server cannot be reached', async () => {
    vi.stubGlobal('fetch', rejectWith('TypeError', 'Failed to fetch'));

    await expect(provider().getModels()).rejects.toThrow(/Cannot reach/);
  });

  it('allows a self-hosted server longer than a second', async () => {
    vi.stubGlobal('fetch', rejectWith('TimeoutError'));
    const timeout = vi.spyOn(AbortSignal, 'timeout');

    await expect(provider().getModels()).rejects.toThrow();

    expect(timeout.mock.calls[0][0]).toBeGreaterThanOrEqual(5000);
    timeout.mockRestore();
  });
});
