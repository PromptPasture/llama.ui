/**
 * Checks if a value is a string.
 *
 * @param x - The value to check
 * @returns `true` if the value is a string, `false` otherwise
 */
export const isString = (x: unknown): x is string => typeof x === 'string';

/**
 * Checks if a value is a boolean.
 *
 * @param x - The value to check
 * @returns `true` if the value is a boolean, `false` otherwise
 */
export const isBoolean = (x: unknown): x is boolean => typeof x === 'boolean';

/**
 * Checks if a value is numeric by ensuring it's not a string, not a boolean,
 * not nullish, and can be converted to a number without resulting in NaN.
 *
 * @param n - The value to check
 * @returns `true` if the value appears to be numeric, `false` otherwise
 */
export const isNumeric = (n: unknown): boolean =>
  !isString(n) && !isBoolean(n) && n != null && !isNaN(Number(n));
