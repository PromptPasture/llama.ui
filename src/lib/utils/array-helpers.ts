/**
 * Selects unique random elements from an array without repetition.
 * If the requested count exceeds the array length, returns the entire array.
 *
 * @param array - The array to select elements from
 * @param count - The number of unique random elements to select (default: 4)
 * @returns An array of unique randomly selected elements
 */
export function getUniqueRandomElements(array: string[], count: number = 4) {
  if (count > array.length) {
    return [...array];
  }

  const arrCopy = [...array];
  const result = [];
  for (let i = 0; i < count; i++) {
    const randomIndex = Math.floor(Math.random() * arrCopy.length);
    result.push(arrCopy.splice(randomIndex, 1)[0]);
  }
  return result;
}
