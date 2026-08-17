import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  getDocument: vi.fn(),
  destroy: vi.fn().mockResolvedValue(undefined),
  workerOptions: {} as { workerSrc?: string },
}));

vi.mock('pdfjs-dist', () => ({
  GlobalWorkerOptions: mocks.workerOptions,
  getDocument: mocks.getDocument,
}));

const { extractPdfText } = await import('./pdf');

/** Stands in for a document pdf.js has opened. */
function documentOf(pages: { str: string; hasEOL?: boolean }[][]) {
  mocks.getDocument.mockReturnValue({
    // destroy lives on the loading task, which owns the worker.
    destroy: mocks.destroy,
    promise: Promise.resolve({
      numPages: pages.length,
      getPage: (n: number) =>
        Promise.resolve({
          getTextContent: () => Promise.resolve({ items: pages[n - 1] }),
        }),
    }),
  });
}

const file = () => new Blob([new Uint8Array([0x25, 0x50, 0x44, 0x46])]);

beforeEach(() => {
  mocks.destroy.mockClear();
});

describe('reading the text out of a PDF', () => {
  it('returns what a page says', async () => {
    documentOf([[{ str: 'Hello from a document.' }]]);

    expect(await extractPdfText(file())).toBe('Hello from a document.');
  });

  it('keeps the line breaks the document marks', async () => {
    documentOf([[{ str: 'First line', hasEOL: true }, { str: 'second line' }]]);

    // pdf.js reports text in the runs the file stores it in, which follow the
    // typesetting. Without them a page arrives as one unbroken paragraph.
    expect(await extractPdfText(file())).toBe('First line\nsecond line');
  });

  it('joins the runs within a line', async () => {
    documentOf([[{ str: 'one ' }, { str: 'sentence' }]]);

    expect(await extractPdfText(file())).toBe('one sentence');
  });

  it('separates the pages', async () => {
    documentOf([[{ str: 'page one' }], [{ str: 'page two' }]]);

    expect(await extractPdfText(file())).toBe('page one\n\npage two');
  });

  it('leaves out a page with nothing on it', async () => {
    documentOf([[{ str: 'page one' }], [], [{ str: 'page three' }]]);

    expect(await extractPdfText(file())).toBe('page one\n\npage three');
  });

  it('has nothing to say about a document with no text layer', async () => {
    documentOf([[], []]);

    // A scan is pages of pictures; there is no text in it to find.
    expect(await extractPdfText(file())).toBe('');
  });

  it('ignores a piece that carries no string', async () => {
    documentOf([
      [{ str: 'kept' }, { hasEOL: true } as unknown as { str: string }],
    ]);

    expect(await extractPdfText(file())).toBe('kept');
  });

  it('lets go of the document when it is done', async () => {
    documentOf([[{ str: 'anything' }]]);

    await extractPdfText(file());

    // The worker holds the larger copy of it.
    expect(mocks.destroy).toHaveBeenCalled();
  });

  it('lets go of it even when reading fails', async () => {
    mocks.getDocument.mockReturnValue({
      destroy: mocks.destroy,
      promise: Promise.resolve({
        numPages: 1,
        getPage: () => Promise.reject(new Error('damaged')),
      }),
    });

    await expect(extractPdfText(file())).rejects.toThrow('damaged');
    expect(mocks.destroy).toHaveBeenCalled();
  });

  it('tells pdf.js where its worker is', async () => {
    documentOf([[{ str: 'anything' }]]);

    await extractPdfText(file());

    // Left unset it guesses at a path that does not exist in the build.
    expect(mocks.workerOptions.workerSrc).toBeTruthy();
  });
});
