/**
 * Removes specified query parameters from the current URL and updates the browser history.
 *
 * @param removeQueryParams - An array of query parameter names to remove from the current URL
 */
export const cleanCurrentUrl = (removeQueryParams: string[]) => {
  const url = new URL(window.location.href);
  removeQueryParams.forEach((param) => {
    url.searchParams.delete(param);
  });
  window.history.replaceState({}, '', url.toString());
};

/**
 * Normalizes a URL by combining a base URL with a path, ensuring proper slash handling.
 *
 * This function removes trailing slashes from the base URL, ensures the path starts with
 * a single slash, and removes any trailing slashes from the final path component.
 *
 * @param path - The path to append (e.g., '/v1/models' or 'v1/models')
 * @param base - The base URL (e.g., 'https://api.example.com' or 'https://example.com/api/')
 * @returns The normalized URL with proper slash formatting
 */
export function normalizeUrl(path: string, base: string) {
  const cleanBase = base.replace(/\/+$/, '');
  const cleanPath = '/' + path.replace(/^\/+|\/+$/g, '');
  return cleanBase + (cleanPath === '/' ? '' : cleanPath);
}
