/**
 * A language-sensitive formatter for both date and time information.
 *
 * @example
 * const date = new Date();
 * dateFormatter.format(date); // Returns localized short date + time
 */
export const dateFormatter = new Intl.DateTimeFormat(
  Intl.DateTimeFormat().resolvedOptions().locale,
  {
    dateStyle: 'short',
    timeStyle: 'short',
  }
);

/**
 * A language-sensitive formatter for time information only.
 *
 * @example
 * const date = new Date();
 * timeFormatter.format(date); // Returns localized short time
 */
export const timeFormatter = new Intl.DateTimeFormat(
  Intl.DateTimeFormat().resolvedOptions().locale,
  {
    timeStyle: 'short',
  }
);
