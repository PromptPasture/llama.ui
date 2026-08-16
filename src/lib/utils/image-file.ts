/**
 * Decides whether a file should be sent as a picture.
 *
 * SVG is deliberately not one. It is markup, and a model reading the markup
 * gets more out of it than a vision model would get from an SVG data URL,
 * which most cannot decode at all. Sent as text it says what it draws.
 *
 * @param type - The file's media type, as the browser reports it
 * @returns Whether to attach it as an image rather than as text
 */
export function isImageType(type: string): boolean {
  return type.startsWith('image/') && type !== 'image/svg+xml';
}

/**
 * Reads a file into a data URL.
 *
 * Which is the form the providers want: an image part carries the picture
 * inline rather than a link to somewhere they would have to fetch it from.
 *
 * @param file - The picture to read
 * @returns A `data:` URL carrying the whole file
 */
export function readAsDataUrl(file: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(reader.error ?? new Error('unreadable'));
    reader.onload = () => {
      const result = reader.result;
      if (typeof result !== 'string') {
        reject(new Error('not a data URL'));
        return;
      }
      resolve(result);
    };
    reader.readAsDataURL(file);
  });
}
