import { afterEach, describe, expect, it } from 'vitest';
import { locale } from 'svelte-i18n';
import { formatDateTime, formatTime } from './formatting';

// 14 March 2024, 15:30 local time.
const WHEN = new Date(2024, 2, 14, 15, 30);

afterEach(() => {
  void locale.set(null);
});

describe('following the language the app is set to', () => {
  it('uses a 24 hour clock for German', () => {
    expect(formatTime(WHEN, 'de')).toBe('15:30');
  });

  it('uses a 12 hour clock for American English', () => {
    expect(formatTime(WHEN, 'en-US')).toMatch(/3:30\s?PM/i);
  });

  it('orders the date the way each language does', () => {
    // The same instant, written the way each locale writes it.
    expect(formatDateTime(WHEN, 'en-US')).toMatch(/^3\/14\/24/);
    expect(formatDateTime(WHEN, 'de')).toMatch(/^14\.03\.24/);
  });

  it('takes the app locale when none is passed', () => {
    void locale.set('de');

    // The interface speaking one language while timestamps follow the
    // operating system reads as a mistake.
    expect(formatTime(WHEN)).toBe('15:30');
  });

  it('changes with the app locale rather than staying as first built', () => {
    void locale.set('de');
    const asGerman = formatTime(WHEN);

    // Japanese also writes 15:30, so compare against one that differs.
    void locale.set('en-US');
    const asAmerican = formatTime(WHEN);

    expect(asGerman).toBe('15:30');
    expect(asAmerican).toMatch(/3:30\s?PM/i);
  });
});

describe('accepting what it is given', () => {
  it('formats a timestamp as readily as a date', () => {
    expect(formatTime(WHEN.getTime(), 'de')).toBe(formatTime(WHEN, 'de'));
  });

  it('falls back rather than throwing on an unusable locale tag', () => {
    // A bad language setting must not take the interface down over a clock.
    expect(() => formatTime(WHEN, 'not a locale')).not.toThrow();
    expect(formatTime(WHEN, 'not a locale')).toBeTruthy();
  });
});
