import { describe, expect, it } from 'vitest';
import {
  describeNetworkFailure,
  errorDetail,
  PROVIDER_TIMEOUT_MS,
} from './response-utils';

/** What fetch rejects with, which is an Error carrying a particular name. */
function rejectedWith(name: string, message = 'something went wrong') {
  const error = new Error(message);
  error.name = name;
  return error;
}

describe('a request that never reached the server', () => {
  it('passes a deliberate cancellation through untouched', () => {
    const stopped = rejectedWith('AbortError', 'The operation was aborted');

    // Chat state recognises generation being stopped by this name. Wrapped in
    // anything, pressing Stop is reported to the reader as a failure.
    expect(describeNetworkFailure(stopped)).toBe(stopped);
  });

  it('says a timeout was a timeout', () => {
    const message = describeNetworkFailure(
      rejectedWith('TimeoutError')
    ).message;

    expect(message).toMatch(/timed out/i);
  });

  it('keeps the reason for anything else', () => {
    const message = describeNetworkFailure(
      rejectedWith('TypeError', 'Failed to fetch')
    ).message;

    // A timeout, a DNS failure, a refused connection and a CORS rejection
    // were all reported as "Server closed connection without response" — a
    // description of none of them.
    expect(message).toContain('Failed to fetch');
    expect(message).toMatch(/cannot reach/i);
  });

  it('still says something when there is no reason to give', () => {
    const message = describeNetworkFailure(undefined).message;

    expect(message).toMatch(/network error/i);
  });

  it('survives being handed something that is not an error', () => {
    expect(() => describeNetworkFailure('a string')).not.toThrow();
  });

  it('always answers with an error, so throwing it says something', () => {
    expect(describeNetworkFailure(rejectedWith('TypeError'))).toBeInstanceOf(
      Error
    );
  });
});

describe('how long to wait for a provider', () => {
  it('allows for a hosted one, not just localhost', () => {
    // Most of the providers shipped with the app are hosted, where a round
    // trip past a second is ordinary.
    expect(PROVIDER_TIMEOUT_MS).toBeGreaterThanOrEqual(5000);
  });
});

describe('reading the reason a server gave', () => {
  it('takes it from where OpenAI puts it', () => {
    expect(errorDetail({ error: { message: 'Invalid API key' } })).toBe(
      'Invalid API key'
    );
  });

  it('takes it when the whole of error is the reason', () => {
    // llama.cpp and LM Studio both answer this way. Read only as a nested
    // message, the reader was told "Unknown error" instead.
    expect(
      errorDetail({ error: 'Unexpected endpoint or method. (GET /nowhere)' })
    ).toBe('Unexpected endpoint or method. (GET /nowhere)');
  });

  it('falls back to a message at the top', () => {
    expect(errorDetail({ message: 'Something went wrong' })).toBe(
      'Something went wrong'
    );
  });

  it('trims what it finds', () => {
    expect(errorDetail({ error: '  padded  ' })).toBe('padded');
  });

  it('says nothing when there is nothing to say', () => {
    expect(errorDetail({ data: [] })).toBe('');
    expect(errorDetail(null)).toBe('');
    expect(errorDetail('a string')).toBe('');
  });
});
