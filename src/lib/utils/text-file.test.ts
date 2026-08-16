import { describe, expect, it } from 'vitest';
import { describeSize, looksBinary, MAX_FILE_BYTES } from './text-file';

const bytesOf = (text: string) => new TextEncoder().encode(text);

describe('telling text from binary', () => {
  it('accepts source code', () => {
    expect(looksBinary(bytesOf('function main() {\n  return 0;\n}\n'))).toBe(
      false
    );
  });

  it('accepts prose that is not English', () => {
    expect(looksBinary(bytesOf('Вставленный текст, 日本語, العربية'))).toBe(
      false
    );
  });

  it('accepts an empty file', () => {
    expect(looksBinary(new Uint8Array())).toBe(false);
  });

  it('refuses something with a null byte in it', () => {
    // Decoded as text this is pages of replacement characters, useless to a
    // model and sent anyway.
    expect(looksBinary(new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x00]))).toBe(
      true
    );
  });

  it('looks past the very start of the file', () => {
    const bytes = new Uint8Array(1000);
    bytes.fill(0x61);
    bytes[900] = 0;

    // A binary with a long ASCII header would otherwise pass.
    expect(looksBinary(bytes)).toBe(true);
  });

  it('stops looking eventually', () => {
    const bytes = new Uint8Array(20000);
    bytes.fill(0x61);
    bytes[19000] = 0;

    // Reading every byte of a large file to decide costs more than it saves.
    expect(looksBinary(bytes)).toBe(false);
  });
});

describe('saying how big a file is', () => {
  it('counts small ones in bytes', () => {
    expect(describeSize(512)).toBe('512B');
  });

  it('moves up a unit once it can', () => {
    expect(describeSize(2048)).toBe('2KB');
  });

  it('keeps one decimal where it says something', () => {
    expect(describeSize(1536 * 1024)).toBe('1.5MB');
  });

  it('drops a trailing zero', () => {
    expect(describeSize(3 * 1024 * 1024)).toBe('3MB');
  });

  it('describes the limit itself', () => {
    expect(describeSize(MAX_FILE_BYTES)).toBe('10MB');
  });
});
