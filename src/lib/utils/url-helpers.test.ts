import { describe, expect, it } from 'vitest';
import { normalizeUrl } from './url-helpers';

describe('joining a base url and a path', () => {
  it('joins them with a single slash', () => {
    expect(normalizeUrl('/v1/models', 'https://api.example.com')).toBe(
      'https://api.example.com/v1/models'
    );
  });

  it('keeps a path the base already carries', () => {
    // Several providers are configured with a prefix, such as
    // https://api.groq.com/openai or .../compatible-mode.
    expect(normalizeUrl('/v1/models', 'https://api.example.com/openai')).toBe(
      'https://api.example.com/openai/v1/models'
    );
  });
});

describe('tolerating the slashes people type', () => {
  it('accepts a base ending in a slash', () => {
    expect(normalizeUrl('/v1/models', 'https://api.example.com/')).toBe(
      'https://api.example.com/v1/models'
    );
  });

  it('accepts a base ending in several', () => {
    expect(normalizeUrl('/v1/models', 'https://api.example.com///')).toBe(
      'https://api.example.com/v1/models'
    );
  });

  it('accepts a path without a leading slash', () => {
    expect(normalizeUrl('v1/models', 'https://api.example.com')).toBe(
      'https://api.example.com/v1/models'
    );
  });

  it('trims a trailing slash from the path', () => {
    expect(normalizeUrl('/v1/models/', 'https://api.example.com')).toBe(
      'https://api.example.com/v1/models'
    );
  });

  it('never doubles the separator', () => {
    for (const base of [
      'https://api.example.com',
      'https://api.example.com/',
      'https://api.example.com//',
    ]) {
      for (const path of ['/v1/models', 'v1/models', '//v1/models']) {
        expect(normalizeUrl(path, base)).toBe(
          'https://api.example.com/v1/models'
        );
      }
    }
  });
});

describe('an empty path', () => {
  it('returns the base untouched', () => {
    expect(normalizeUrl('', 'https://api.example.com')).toBe(
      'https://api.example.com'
    );
  });

  it('treats a lone slash the same way', () => {
    expect(normalizeUrl('/', 'https://api.example.com/')).toBe(
      'https://api.example.com'
    );
  });
});

describe('a local server', () => {
  it('keeps the port', () => {
    expect(normalizeUrl('/props', 'http://localhost:8080')).toBe(
      'http://localhost:8080/props'
    );
  });
});
