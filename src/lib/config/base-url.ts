export const baseUrl: string = new URL('.', document.baseURI).href
  .toString()
  .replace(/\/$/, '');
