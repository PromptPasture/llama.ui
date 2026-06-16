/**
 * Checks if a value is a string by verifying it has a `toLowerCase` method.
 * Note: This is a heuristic check and may produce false positives for objects
 * that have a `toLowerCase` property but aren't actually strings.
 *
 * @param x - The value to check
 * @returns `true` if the value appears to be a string, `false` otherwise
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const isString = (x: any) => !!x.toLowerCase;

/**
 * Checks if a value is a boolean by comparing it to `true` and `false`.
 *
 * @param x - The value to check
 * @returns `true` if the value is strictly equal to `true` or `false`, `false` otherwise
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const isBoolean = (x: any) => x === true || x === false;

/**
 * Checks if a value is numeric by ensuring it's not a string, not a boolean,
 * and can be converted to a number without resulting in NaN.
 *
 * @param n - The value to check
 * @returns `true` if the value appears to be numeric, `false` otherwise
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const isNumeric = (n: any) => !isString(n) && !isNaN(n) && !isBoolean(n);
