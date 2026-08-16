import { describe, expect, it, vi } from 'vitest';
import { processSSEStream } from './sse-parser';

/** Builds a Response whose body delivers the given pieces as separate reads. */
function streamOf(pieces: string[]): Response {
  const encoder = new TextEncoder();
  const body = new ReadableStream({
    start(controller) {
      for (const p of pieces) controller.enqueue(encoder.encode(p));
      controller.close();
    },
  });
  return new Response(body);
}

async function collect(pieces: string[]) {
  const out: unknown[] = [];
  for await (const chunk of processSSEStream(streamOf(pieces))) out.push(chunk);
  return out;
}

describe('reading a well-formed stream', () => {
  it('yields each data event', async () => {
    expect(
      await collect(['data: {"a":1}\n', 'data: {"a":2}\n', 'data: [DONE]\n'])
    ).toEqual([{ a: 1 }, { a: 2 }]);
  });

  it('reassembles an event split across reads', async () => {
    // TCP splits wherever it likes; a JSON payload can arrive in pieces.
    expect(await collect(['data: {"a"', ':1}\n', 'data: [DONE]\n'])).toEqual([
      { a: 1 },
    ]);
  });

  it('stops at [DONE] and ignores anything after it', async () => {
    expect(
      await collect(['data: {"a":1}\n', 'data: [DONE]\n', 'data: {"a":2}\n'])
    ).toEqual([{ a: 1 }]);
  });

  it('skips blank lines and comments', async () => {
    expect(
      await collect([': keep-alive\n', '\n', 'data: {"a":1}\n', '\n'])
    ).toEqual([{ a: 1 }]);
  });

  it('ignores fields other than data', async () => {
    expect(
      await collect(['event: ping\n', 'id: 7\n', 'data: {"a":1}\n'])
    ).toEqual([{ a: 1 }]);
  });
});

describe('reading a stream that ends abruptly', () => {
  it('keeps a final event that arrived without a trailing newline', async () => {
    // A server closing straight after its last event used to lose it, which
    // truncated the end of the reply.
    expect(
      await collect(['data: {"a":1}\n', 'data: {"final":"token"}'])
    ).toEqual([{ a: 1 }, { final: 'token' }]);
  });

  it('handles a stream that is only one unterminated event', async () => {
    expect(await collect(['data: {"only":true}'])).toEqual([{ only: true }]);
  });

  it('terminates on an empty stream', async () => {
    expect(await collect([])).toEqual([]);
  });

  it('terminates when the last line is a bare [DONE] without a newline', async () => {
    expect(await collect(['data: {"a":1}\n', 'data: [DONE]'])).toEqual([
      { a: 1 },
    ]);
  });
});

describe('reading a stream with bad content', () => {
  it('skips an unparsable data line and continues', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    expect(await collect(['data: not json\n', 'data: {"a":1}\n'])).toEqual([
      { a: 1 },
    ]);
    expect(warn).toHaveBeenCalled();
    warn.mockRestore();
  });

  it('raises a server-sent error event', async () => {
    await expect(
      collect(['error: {"message":"model not loaded"}\n'])
    ).rejects.toThrow('model not loaded');
  });

  it('rejects a response with no body', async () => {
    const bodyless = { body: null } as Response;
    await expect(
      (async () => {
        for await (const _ of processSSEStream(bodyless)) void _;
      })()
    ).rejects.toThrow(/body is empty/);
  });
});
