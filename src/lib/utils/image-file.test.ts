import { describe, expect, it } from 'vitest';
import { isImageType, readAsDataUrl } from './image-file';

describe('deciding what to send as a picture', () => {
  it('takes a photograph', () => {
    expect(isImageType('image/jpeg')).toBe(true);
  });

  it('takes a screenshot', () => {
    expect(isImageType('image/png')).toBe(true);
  });

  it('leaves SVG to be read as text', () => {
    // It is markup: read as markup it says what it draws, and most vision
    // models cannot decode an SVG data URL at all.
    expect(isImageType('image/svg+xml')).toBe(false);
  });

  it('leaves a text file alone', () => {
    expect(isImageType('text/plain')).toBe(false);
  });

  it('leaves a file with no type at all alone', () => {
    expect(isImageType('')).toBe(false);
  });
});

describe('reading a picture for sending', () => {
  it('gives back a data URL carrying the file', async () => {
    const file = new File([new Uint8Array([1, 2, 3])], 'shot.png', {
      type: 'image/png',
    });

    const url = await readAsDataUrl(file);

    // The providers want the picture inline, not a link to fetch it from.
    expect(url.startsWith('data:image/png;base64,')).toBe(true);
  });

  it('reports a file it cannot read', async () => {
    const unreadable = {
      // What a Blob looks like to FileReader when the file is gone from disk.
      stream: () => {
        throw new Error('gone');
      },
    } as unknown as Blob;

    await expect(readAsDataUrl(unreadable)).rejects.toThrow();
  });
});
