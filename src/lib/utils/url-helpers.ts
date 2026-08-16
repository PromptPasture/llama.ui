/**
 * Joins a base URL and a path, tolerating the slashes people actually type.
 *
 * The base URL comes from a settings field, so it may or may not end in a
 * slash; the path is supplied by a provider and may or may not begin with one.
 *
 * @param path - The path to append, with or without a leading slash.
 * @param base - The base URL, with or without a trailing slash.
 * @returns The two joined by exactly one slash.
 */
export function normalizeUrl(path: string, base: string) {
  const cleanBase = base.replace(/\/+$/, '');
  const cleanPath = '/' + path.replace(/^\/+|\/+$/g, '');
  return cleanBase + (cleanPath === '/' ? '' : cleanPath);
}
