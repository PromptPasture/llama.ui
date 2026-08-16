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
