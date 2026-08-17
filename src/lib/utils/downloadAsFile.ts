/**
 * Hands something to the browser as a file to save.
 *
 * @param blobParts - What the file is made of
 * @param fileName - What to save it under
 * @param type - Its media type. Labelled as JSON, a markdown file opens in
 *   whatever the system uses for JSON and reads as a broken one.
 */
export const downloadAsFile = (
  blobParts: BlobPart[],
  fileName: string,
  type: string = 'application/json'
) => {
  const blob = new Blob(blobParts, { type });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
};
