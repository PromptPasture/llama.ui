import { get } from 'svelte/store';
import { locale as appLocale } from 'svelte-i18n';

/** Formatters are not cheap to build, and the locale rarely changes. */
const cache = new Map<string, Intl.DateTimeFormat>();

const systemLocale = () => Intl.DateTimeFormat().resolvedOptions().locale;

/**
 * Resolves the locale to format in, preferring the language chosen in the app
 * over the one the operating system reports. Formatting a timestamp the system
 * way while the interface speaks another language reads as a mistake.
 *
 * @param preferred - An explicit locale, usually `$locale` from a component.
 * @returns A locale tag Intl accepts.
 */
function resolveLocale(preferred?: string | null): string {
  const candidate = preferred || get(appLocale) || systemLocale();
  try {
    Intl.DateTimeFormat.supportedLocalesOf(candidate);
    return candidate;
  } catch {
    // An unusable tag must not take the interface down over a timestamp.
    return systemLocale();
  }
}

function formatterFor(
  kind: string,
  options: Intl.DateTimeFormatOptions,
  preferred?: string | null
): Intl.DateTimeFormat {
  const resolved = resolveLocale(preferred);
  const key = `${kind}:${resolved}`;
  let formatter = cache.get(key);
  if (!formatter) {
    formatter = new Intl.DateTimeFormat(resolved, options);
    cache.set(key, formatter);
  }
  return formatter;
}

/**
 * Formats a time of day in the language the app is set to.
 *
 * @param value - A date or a timestamp in milliseconds.
 * @param preferred - Pass `$locale` from a component so the value re-renders
 *                    when the language is changed.
 * @returns The localised time.
 */
export function formatTime(
  value: Date | number,
  preferred?: string | null
): string {
  return formatterFor('time', { timeStyle: 'short' }, preferred).format(value);
}

/**
 * Formats a date and time in the language the app is set to.
 *
 * @param value - A date or a timestamp in milliseconds.
 * @param preferred - Pass `$locale` from a component so the value re-renders
 *                    when the language is changed.
 * @returns The localised date and time.
 */
export function formatDateTime(
  value: Date | number,
  preferred?: string | null
): string {
  return formatterFor(
    'datetime',
    { dateStyle: 'short', timeStyle: 'short' },
    preferred
  ).format(value);
}
