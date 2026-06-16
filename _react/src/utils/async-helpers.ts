/**
 * Creates a promise that resolves after a specified number of milliseconds.
 * Useful for creating artificial delays in async functions.
 *
 * @param ms - The number of milliseconds to delay
 * @returns A promise that resolves after the specified delay
 */
export const delay = (ms: number) =>
  new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Creates a throttled function that only invokes the callback at most once
 * per specified delay period. Subsequent calls within the delay period are ignored.
 *
 * @template T - The argument types of the callback function
 * @param callback - The function to throttle
 * @param delay - The throttle delay in milliseconds
 * @returns A throttled version of the callback function
 */
export const throttle = <T extends unknown[]>(
  callback: (...args: T) => void,
  delay: number
) => {
  let isWaiting = false;

  return (...args: T) => {
    if (isWaiting) {
      return;
    }

    callback(...args);
    isWaiting = true;

    setTimeout(() => {
      isWaiting = false;
    }, delay);
  };
};
