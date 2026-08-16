import { describe, expect, it, vi } from 'vitest';
import CONFIG_DEFAULT from '../config/config-default.json';
import LocalStorage from './localStorage';

const merge = (saved: unknown) =>
  LocalStorage.mergeConfig(saved as Partial<typeof CONFIG_DEFAULT>);

describe('keeping sound stored values', () => {
  it('layers stored values over the defaults', () => {
    const merged = merge({
      baseUrl: 'http://localhost:1234',
      temperature: 0.5,
    });
    expect(merged.baseUrl).toBe('http://localhost:1234');
    expect(merged.temperature).toBe(0.5);
  });

  it('falls back to defaults for keys that were never stored', () => {
    const merged = merge({ baseUrl: 'http://x' });
    expect(merged.custom).toBe(CONFIG_DEFAULT.custom);
    expect(merged.provider).toBe(CONFIG_DEFAULT.provider);
  });

  it('keeps a stored false, which is falsy but valid', () => {
    const merged = merge({ excludeThoughtOnReq: false });
    expect(merged.excludeThoughtOnReq).toBe(false);
  });

  it('keeps a stored empty string and zero', () => {
    const merged = merge({ apiKey: '', temperature: 0 });
    expect(merged.apiKey).toBe('');
    expect(merged.temperature).toBe(0);
  });
});

describe('rejecting values that would break the app', () => {
  it('ignores a null custom, which otherwise throws on every send', () => {
    // configToCustomOptions calls config.custom.trim() before any request.
    const merged = merge({ custom: null });
    expect(merged.custom).toBe(CONFIG_DEFAULT.custom);
    expect(() => merged.custom.trim()).not.toThrow();
  });

  it.each([
    ['a number where a string belongs', { baseUrl: 42 }, 'baseUrl'],
    ['a string where a number belongs', { temperature: '0.7' }, 'temperature'],
    [
      'a string where a boolean belongs',
      { excludeThoughtOnReq: 'yes' },
      'excludeThoughtOnReq',
    ],
    ['an object where a string belongs', { custom: { a: 1 } }, 'custom'],
    ['an array where a string belongs', { apiKey: ['k'] }, 'apiKey'],
  ])('ignores %s', (_label, saved, key) => {
    const merged = merge(saved) as unknown as Record<string, unknown>;
    expect(merged[key]).toBe((CONFIG_DEFAULT as Record<string, unknown>)[key]);
  });

  it('warns about what it ignored, so the cause is discoverable', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    merge({ custom: null });
    expect(warn).toHaveBeenCalledWith(expect.stringContaining('custom'));
    warn.mockRestore();
  });

  it('drops keys this version does not recognise', () => {
    const merged = merge({ someRemovedSetting: 'x' }) as unknown as Record<
      string,
      unknown
    >;
    expect(merged.someRemovedSetting).toBeUndefined();
  });

  it('survives a stored value that is not an object at all', () => {
    expect(merge('nonsense').custom).toBe(CONFIG_DEFAULT.custom);
    expect(merge(null).provider).toBe(CONFIG_DEFAULT.provider);
  });

  it('yields a config whose every value matches the default type', () => {
    const merged = merge({
      custom: null,
      baseUrl: 42,
      temperature: 'hot',
    }) as unknown as Record<string, unknown>;

    for (const [key, fallback] of Object.entries(CONFIG_DEFAULT)) {
      expect(typeof merged[key]).toBe(typeof fallback);
    }
  });
});
