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

describe('a response that was not streamed at all', () => {
  const completion = {
    id: 'x',
    choices: [{ message: { role: 'assistant', content: 'the answer' } }],
  };

  it('hands the body over as a single chunk', async () => {
    const chunks = await collect([JSON.stringify(completion)]);

    // A server may ignore the request to stream and answer with one ordinary
    // completion. Read as events there are none, and the reply said nothing.
    expect(chunks).toEqual([completion]);
  });

  it('says nothing for an empty body', async () => {
    expect(await collect([''])).toEqual([]);
  });

  it('says nothing for a body that is neither events nor JSON', async () => {
    expect(await collect(['<html>gateway error</html>'])).toEqual([]);
  });

  // Pins the outcome rather than the guard that produces it: a body that
  // arrived as events is not valid JSON as a whole, so it would fail to parse
  // even without the flag that stops it being tried. The flag is there to stop
  // a long reply being held in memory twice over.
  it('does not repeat a body that did arrive as events', async () => {
    const chunks = await collect([
      'data: {"n":1}\n\ndata: {"n":2}\n\ndata: [DONE]\n\n',
    ]);

    expect(chunks).toEqual([{ n: 1 }, { n: 2 }]);
  });
});
