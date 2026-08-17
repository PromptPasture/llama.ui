/**
 * Reads the text out of a PDF.
 *
 * Loaded on demand rather than with the app: pdf.js is larger than everything
 * else here put together, and most conversations never involve a PDF at all.
 *
 * @param file - The document to read
 * @returns Its text, pages separated by blank lines
 */
export async function extractPdfText(file: Blob): Promise<string> {
  const pdfjs = await import('pdfjs-dist');
  // The worker is a separate file, and Vite needs to be told where it will
  // end up rather than being left to guess at runtime.
  pdfjs.GlobalWorkerOptions.workerSrc = new URL(
    'pdfjs-dist/build/pdf.worker.min.mjs',
    import.meta.url
  ).href;

  const data = new Uint8Array(await file.arrayBuffer());
  const loading = pdfjs.getDocument({ data });
  const doc = await loading.promise;
  try {
    const pages: string[] = [];
    for (let number = 1; number <= doc.numPages; number++) {
      const page = await doc.getPage(number);
      const content = await page.getTextContent();
      pages.push(pageText(content.items));
    }
    return pages
      .map((page) => page.trim())
      .filter(Boolean)
      .join('\n\n');
  } finally {
    // The loading task owns the worker, and the worker holds the larger copy
    // of the document. Left running, one stays alive per PDF ever attached.
    await loading.destroy();
  }
}

/** A text item as pdf.js reports it, with the parts this needs. */
interface TextItem {
  str?: string;
  hasEOL?: boolean;
}

/**
 * Joins one page's pieces back into lines.
 *
 * pdf.js reports text in the runs the document happens to store it in, which
 * follow the typesetting rather than the sentences. Run together without the
 * line breaks it marks, a page arrives as one unbroken paragraph.
 *
 * @param items - The pieces of one page, in order
 * @returns The page as text
 */
function pageText(items: readonly unknown[]): string {
  let out = '';
  for (const item of items) {
    const piece = item as TextItem;
    if (typeof piece.str !== 'string') continue;
    out += piece.str;
    out += piece.hasEOL ? '\n' : '';
  }
  return out;
}
