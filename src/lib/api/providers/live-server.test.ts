import { beforeAll, describe, expect, it } from 'vitest';
import CONFIG_DEFAULT from '../../config/config-default.json';
import { normalizeMsgsForAPI } from '../message-normalization';
import { generateChatStream } from '../../services/inference-service';
import { BaseOpenAIProvider } from './BaseOpenAIProvider';
import type { Configuration, Message } from '../../types';

/**
 * Checks the request path against a server that is actually running.
 *
 * Skipped unless one is named, so this costs nothing in CI:
 *
 * ```
 * LLAMA_UI_LIVE_URL=http://localhost:1234 npm test
 * ```
 *
 * Worth having because mocks answer the shape they were told to. The token
 * counts never arrived from any OpenAI-compatible server for two reasons at
 * once — they were not asked for, and the chunk carrying them was discarded
 * for having no choices — and every unit test passed throughout.
 */
const LIVE_URL = process.env.LLAMA_UI_LIVE_URL;

const ask = (content: string): Message[] =>
  [
    {
      id: 1,
      convId: 'live',
      type: 'text',
      timestamp: 1,
      role: 'user',
      content,
      parent: -1,
      children: [],
    },
  ] as Message[];

describe.skipIf(!LIVE_URL)('against a server that is running', () => {
  const provider = () => BaseOpenAIProvider.new(LIVE_URL);
  let model = '';

  /** Whatever that server has, rather than a name written down here. */
  beforeAll(async () => {
    const models = await provider().getModels();
    model = models[0]?.id ?? '';
  });

  /** Bounded, so a reasoning model does not think for the whole timeout. */
  const briefly = () =>
    ({
      ...CONFIG_DEFAULT,
      baseUrl: LIVE_URL,
      max_tokens: 32,
      overrideGenerationOptions: true,
    }) as unknown as Configuration;

  it('lists the models it has', async () => {
    const models = await provider().getModels();

    expect(models.length).toBeGreaterThan(0);
    expect(models[0].id).toBeTruthy();
  });

  it('streams a reply in more than one piece', async () => {
    let updates = 0;
    await generateChatStream({
      provider: provider(),
      config: briefly(),
      model,
      messages: ask('Say hello.'),
      signal: AbortSignal.timeout(60_000),
      onUpdate: () => updates++,
    });

    expect(updates).toBeGreaterThan(1);
  }, 90_000);

  it('says how many tokens it used', async () => {
    // Merged the way chat state merges them: each update carries only what
    // changed, so the counts are not in the last one.
    let merged: Record<string, unknown> = {};
    await generateChatStream({
      provider: provider(),
      config: briefly(),
      model,
      messages: ask('Say hello.'),
      signal: AbortSignal.timeout(60_000),
      onUpdate: (update) => {
        merged = { ...merged, ...update };
      },
    });

    // What was broken: no counts arrived from anything but llama.cpp, and
    // the performance metrics were blank without explanation.
    expect(merged.timings).toMatchObject({
      prompt_n: expect.any(Number),
      predicted_n: expect.any(Number),
    });
  }, 90_000);

  it('carries an attachment as far as the model', async () => {
    // An attachment turns the message into an array of content parts rather
    // than a string. Asking whether the request was refused proves little:
    // a lenient server accepts a malformed shape and quietly sends the model
    // nothing. So the attachment carries a word nothing else would produce,
    // and the reply has to contain it.
    const withNote = [
      {
        ...ask('Repeat the secret word from the note, and nothing else.')[0],
        extra: [
          {
            type: 'textFile',
            name: 'note.txt',
            content: 'The secret word is Vondrapple.',
          },
        ],
      },
    ] as Message[];

    let merged: Record<string, unknown> = {};
    await generateChatStream({
      provider: provider(),
      config: { ...briefly(), max_tokens: 400 } as Configuration,
      model,
      // Normalised first, as chat state does: this is where an attachment
      // becomes content parts, and passing the message straight through
      // sends the server a field it has never heard of.
      messages: normalizeMsgsForAPI(withNote) as unknown as Message[],
      signal: AbortSignal.timeout(90_000),
      onUpdate: (update) => {
        merged = { ...merged, ...update };
      },
    });

    // A reasoning model spends most of its budget thinking, and the word
    // turns up there first.
    const said = `${merged.reasoning_content ?? ''} ${merged.content ?? ''}`;
    expect(said.toLowerCase()).toContain('vondrapple');
  }, 120_000);

  it('says what went wrong when there is nothing at that address', async () => {
    const nowhere = BaseOpenAIProvider.new('http://localhost:9');

    await expect(nowhere.getModels()).rejects.toThrow(/cannot reach/i);
  }, 30_000);
});
