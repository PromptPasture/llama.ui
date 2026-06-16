import { type ClassValue, clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

/**
 * Generates a space-separated class string from an object where keys are class names
 * and values are boolean flags indicating whether to include the class.
 *
 * @param classes - An object mapping class names to boolean inclusion flags
 * @returns A space-separated string of class names that had truthy values
 */
export function classNames(classes: Record<string, boolean>): string {
  return Object.entries(classes)
    .filter(([_, value]) => value)
    .map(([key, _]) => key)
    .join(' ');
}

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
