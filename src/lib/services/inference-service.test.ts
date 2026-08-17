import { describe, expect, it, vi } from 'vitest';
import CONFIG_DEFAULT from '../config/config-default.json';
import { generateChatStream } from './inference-service';

/**
 * Chunks come from whichever server the user pointed the app at, so the shapes
 * here are what OpenAI-compatible implementations actually emit rather than
 * what the types promise.
 */
function providerYielding(chunks: unknown[]) {
  return {
    postChatCompletions: vi.fn().mockResolvedValue(
      (async function* () {
        for (const c of chunks) yield c;
      })()
    ),
  };
}

async function run(chunks: unknown[]) {
  const onUpdate = vi.fn();
  await generateChatStream({
    provider: providerYielding(chunks) as never,
    config: CONFIG_DEFAULT as never,
    model: 'm',
    messages: [],
    signal: new AbortController().signal,
    onUpdate,
  });
  // onUpdate emits only the fields that changed, so merge them the way
  // _generate does to see the message as the user would.
  const last = onUpdate.mock.calls.reduce(
    (acc, [update]) => ({ ...acc, ...update }),
    {} as Record<string, unknown>
  );
  return { onUpdate, last };
}

describe('streaming a reply', () => {
  it('accumulates content across chunks', async () => {
    const { last } = await run([
      { choices: [{ delta: { content: 'Hel' } }] },
      { choices: [{ delta: { content: 'lo' } }] },
    ]);
    expect(last.content).toBe('Hello');
  });

  it('accumulates reasoning separately from content', async () => {
    const { last } = await run([
      { choices: [{ delta: { reasoning_content: 'think' } }] },
      { choices: [{ delta: { content: 'answer' } }] },
    ]);
    expect(last.content).toBe('answer');
    expect(last.reasoning_content).toBe('think');
  });
});

describe('surviving chunk shapes the types do not promise', () => {
  it('keeps the reply when a terminal chunk omits delta', async () => {
    // Throwing here used to reject the whole stream, and _generate then
    // dropped the pending message — losing everything already streamed.
    const { last } = await run([
      { choices: [{ delta: { content: 'kept' } }] },
      { choices: [{ index: 0, finish_reason: 'stop' }] },
    ]);
    expect(last.content).toBe('kept');
  });

  it('keeps the reply when a choice entry is null', async () => {
    const { last } = await run([
      { choices: [{ delta: { content: 'kept' } }] },
      { choices: [null] },
    ]);
    expect(last.content).toBe('kept');
  });

  it('ignores a chunk whose choices are missing or empty', async () => {
    const { last } = await run([
      { choices: [{ delta: { content: 'kept' } }] },
      {},
      { choices: [] },
    ]);
    expect(last.content).toBe('kept');
  });

  it('still raises a server-reported error', async () => {
    await expect(
      run([{ error: { message: 'context length exceeded' } }])
    ).rejects.toThrow('context length exceeded');
  });
});

describe('a reply that arrived whole rather than in pieces', () => {
  it('is read from the finished message', async () => {
    // A server that ignores the request to stream answers this way. Read only
    // as a delta, it said nothing at all.
    const { last } = await run([
      {
        choices: [
          { message: { role: 'assistant', content: 'the whole answer' } },
        ],
      },
    ]);

    expect(last.content).toBe('the whole answer');
  });

  it('reads its reasoning too', async () => {
    const { last } = await run([
      {
        choices: [
          {
            message: {
              role: 'assistant',
              content: 'answer',
              reasoning_content: 'thinking',
            },
          },
        ],
      },
    ]);

    expect(last.reasoning_content).toBe('thinking');
  });
});

describe('the chunk that carries how many tokens were used', () => {
  /** What an OpenAI-compatible server sends last when usage was asked for:
   * no choices at all, only the count. Verified against LM Studio. */
  const usageChunk = {
    choices: [],
    usage: { prompt_tokens: 11, completion_tokens: 7, total_tokens: 18 },
  };

  it('is read rather than thrown away for having no choices', async () => {
    const { last } = await run([
      { choices: [{ delta: { content: 'hello' } }] },
      usageChunk,
    ]);

    // Performance metrics showed nothing on every server but llama.cpp,
    // whose own timings arrive alongside a choice.
    expect(last.timings).toEqual({ prompt_n: 11, predicted_n: 7 });
  });

  it('keeps the reply that came before it', async () => {
    const { last } = await run([
      { choices: [{ delta: { content: 'hello' } }] },
      usageChunk,
    ]);

    expect(last.content).toBe('hello');
  });

  it('still ignores an empty chunk that says nothing at all', async () => {
    const { last } = await run([
      { choices: [{ delta: { content: 'hello' } }] },
      { choices: [] },
    ]);

    expect(last.timings).toBeUndefined();
    expect(last.content).toBe('hello');
  });
});

describe('a chunk carrying a refusal', () => {
  it('reports it when the reason is nested, as OpenAI sends it', async () => {
    await expect(
      run([{ error: { message: 'Rate limit exceeded' } }])
    ).rejects.toThrow(/Rate limit exceeded/);
  });

  it('reports it when the whole of error is the reason', async () => {
    // llama.cpp and LM Studio answer this way; it used to arrive as
    // "Unknown error" with the reason thrown away.
    await expect(
      run([{ error: 'Unexpected endpoint or method. (POST /nowhere)' }])
    ).rejects.toThrow(/Unexpected endpoint or method/);
  });

  it('still says something when the reason is unreadable', async () => {
    await expect(run([{ error: { code: 500 } }])).rejects.toThrow(
      /Unknown error/
    );
  });
});
