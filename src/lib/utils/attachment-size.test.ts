import { describe, expect, it } from 'vitest';
import { attachmentSize } from './attachment-size';
import type { MessageExtra } from '$lib/types';

const text = (content: string): MessageExtra => ({
  type: 'textFile',
  name: 'notes.txt',
  content,
});

describe('measuring an attachment', () => {
  it('counts the characters of a plain note', () => {
    expect(attachmentSize(text('hello'))).toBe(5);
  });

  it('counts what the text actually costs to send', () => {
    // Sent as UTF-8, where anything outside ASCII costs more than one byte:
    // measured by length this would read as 2.
    expect(attachmentSize(text('日本'))).toBe(6);
  });

  it('has nothing to report for an empty one', () => {
    expect(attachmentSize(text(''))).toBe(0);
  });

  it('measures pasted context the same way', () => {
    expect(
      attachmentSize({ type: 'context', name: 'pasted', content: 'hello' })
    ).toBe(5);
  });

  it('measures what a picture decodes to, not its encoding', () => {
    // 'AAAA' is four base64 characters, which carry three bytes.
    expect(
      attachmentSize({
        type: 'imageFile',
        name: 'shot.png',
        base64Url: 'data:image/png;base64,AAAA',
      })
    ).toBe(3);
  });

  it('does not count the padding of a picture', () => {
    expect(
      attachmentSize({
        type: 'imageFile',
        name: 'shot.png',
        base64Url: 'data:image/png;base64,AA==',
      })
    ).toBe(1);
  });

  it('measures a picture with no data url prefix', () => {
    expect(
      attachmentSize({
        type: 'imageFile',
        name: 'shot.png',
        base64Url: 'AAAA',
      })
    ).toBe(3);
  });

  it('measures audio the same way', () => {
    expect(
      attachmentSize({
        type: 'audioFile',
        name: 'clip.mp3',
        base64Data: 'AAAAAAAA',
        mimeType: 'audio/mp3',
      })
    ).toBe(6);
  });

  it('reports nothing rather than a negative size', () => {
    expect(
      attachmentSize({
        type: 'imageFile',
        name: 'broken.png',
        base64Url: 'data:image/png;base64,',
      })
    ).toBe(0);
  });
});
