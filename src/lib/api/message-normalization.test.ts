import { describe, expect, it } from 'vitest';
import { normalizeMsgsForAPI } from './message-normalization';
import type { Message, MessageExtra } from '../types';

function msg(overrides: Partial<Message> = {}): Message {
  return {
    id: 1,
    convId: 'conv-1',
    type: 'text',
    timestamp: 1700000000000,
    role: 'user',
    content: 'hello',
    parent: -1,
    children: [],
    ...overrides,
  };
}

const first = (m: Message) => normalizeMsgsForAPI([m])[0];

describe('plain messages', () => {
  it('sends a user message as a string', () => {
    expect(first(msg())).toEqual({ role: 'user', content: 'hello' });
  });

  it('sends a user message with no attachments as a string', () => {
    // Every user message is stored with `extra: []`, and an empty array is
    // truthy — so this used to take the multimodal path.
    expect(first(msg({ extra: [] }))).toEqual({
      role: 'user',
      content: 'hello',
    });
  });

  it('sends assistant and system messages as strings', () => {
    expect(first(msg({ role: 'assistant', content: 'hi' }))).toEqual({
      role: 'assistant',
      content: 'hi',
    });
    expect(first(msg({ role: 'system', content: 'be nice' }))).toEqual({
      role: 'system',
      content: 'be nice',
    });
  });

  it('leaves an assistant message alone even if it carries extras', () => {
    const extra: MessageExtra[] = [
      { type: 'context', name: 'c', content: 'ctx' },
    ];
    expect(first(msg({ role: 'assistant', extra }))).toEqual({
      role: 'assistant',
      content: 'hello',
    });
  });

  it('preserves order across a conversation', () => {
    const out = normalizeMsgsForAPI([
      msg({ id: 1, role: 'user', content: 'q' }),
      msg({ id: 2, role: 'assistant', content: 'a' }),
    ]);
    expect(out.map((m) => m.role)).toEqual(['user', 'assistant']);
  });
});

describe('messages carrying attachments', () => {
  it('puts attachments before the user text, for cache reuse', () => {
    const extra: MessageExtra[] = [
      { type: 'context', name: 'ctx', content: 'background' },
    ];
    expect(first(msg({ extra })).content).toEqual([
      { type: 'text', text: 'background' },
      { type: 'text', text: 'hello' },
    ]);
  });

  it('labels a text file with its name', () => {
    const extra: MessageExtra[] = [
      { type: 'textFile', name: 'notes.md', content: 'body' },
    ];
    const parts = first(msg({ extra })).content as Array<{ text: string }>;
    expect(parts[0].text).toContain('notes.md');
    expect(parts[0].text).toContain('body');
  });

  it('sends an image as an image_url part', () => {
    const extra: MessageExtra[] = [
      {
        type: 'imageFile',
        name: 'p.png',
        base64Url: 'data:image/png;base64,X',
      },
    ];
    expect(first(msg({ extra })).content).toContainEqual({
      type: 'image_url',
      image_url: { url: 'data:image/png;base64,X' },
    });
  });

  it('distinguishes wav from mp3 audio', () => {
    const wav: MessageExtra[] = [
      { type: 'audioFile', name: 'a', base64Data: 'D', mimeType: 'audio/wav' },
    ];
    const mp3: MessageExtra[] = [
      { type: 'audioFile', name: 'a', base64Data: 'D', mimeType: 'audio/mpeg' },
    ];
    expect(first(msg({ extra: wav })).content).toContainEqual({
      type: 'input_audio',
      input_audio: { data: 'D', format: 'wav' },
    });
    expect(first(msg({ extra: mp3 })).content).toContainEqual({
      type: 'input_audio',
      input_audio: { data: 'D', format: 'mp3' },
    });
  });

  it('keeps several attachments in order, text last', () => {
    const extra: MessageExtra[] = [
      { type: 'context', name: 'a', content: 'one' },
      { type: 'context', name: 'b', content: 'two' },
    ];
    expect(first(msg({ extra })).content).toEqual([
      { type: 'text', text: 'one' },
      { type: 'text', text: 'two' },
      { type: 'text', text: 'hello' },
    ]);
  });

  it('refuses an attachment kind it does not understand', () => {
    const extra = [{ type: 'hologram' }] as unknown as MessageExtra[];
    expect(() => first(msg({ extra }))).toThrow(/Unknown extra type/);
  });
});
