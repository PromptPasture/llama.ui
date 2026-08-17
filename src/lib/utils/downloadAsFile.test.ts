import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { downloadAsFile } from './downloadAsFile';

let created: Blob[] = [];
let revoked: string[] = [];

beforeEach(() => {
  created = [];
  revoked = [];
  vi.stubGlobal('URL', {
    createObjectURL: (blob: Blob) => {
      created.push(blob);
      return 'blob:the-file';
    },
    revokeObjectURL: (url: string) => revoked.push(url),
  });
});

afterEach(() => {
  vi.unstubAllGlobals();
});

/** The anchor a download is performed through, caught before it is removed. */
function catchTheLink() {
  const clicked: HTMLAnchorElement[] = [];
  const realClick = HTMLAnchorElement.prototype.click;
  HTMLAnchorElement.prototype.click = function (this: HTMLAnchorElement) {
    clicked.push(this);
  };
  return {
    clicked,
    restore: () => {
      HTMLAnchorElement.prototype.click = realClick;
    },
  };
}

describe('downloading something as a file', () => {
  it('gives the browser the name to save it under', () => {
    const link = catchTheLink();

    downloadAsFile(['{}'], 'a-conversation.json');

    expect(link.clicked[0]?.download).toBe('a-conversation.json');
    link.restore();
  });

  it('calls it JSON by default, which is what the backups are', () => {
    const link = catchTheLink();

    downloadAsFile(['{}'], 'a-conversation.json');

    expect(created[0]?.type).toBe('application/json');
    link.restore();
  });

  it('takes the type when the file is not JSON', () => {
    const link = catchTheLink();

    downloadAsFile(['# A conversation'], 'a-conversation.md', 'text/markdown');

    // Labelled as JSON, a markdown file opens in whatever the system uses for
    // JSON, and reads as a broken one.
    expect(created[0]?.type).toBe('text/markdown');
    link.restore();
  });

  it('lets go of the file it made', () => {
    const link = catchTheLink();

    downloadAsFile(['{}'], 'a-conversation.json');

    // The blob is held in memory until it is released, and a session of
    // downloads would keep every one of them.
    expect(revoked).toEqual(['blob:the-file']);
    link.restore();
  });

  it('leaves nothing behind in the page', () => {
    const link = catchTheLink();

    downloadAsFile(['{}'], 'a-conversation.json');

    expect(document.querySelectorAll('a[download]')).toHaveLength(0);
    link.restore();
  });
});
