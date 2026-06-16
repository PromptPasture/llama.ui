import { useEffect, useMemo, useState } from 'react';

type FilterFunction<T> = (item: T) => boolean;

interface UseFilterOptions<T> {
  initialFilter?: FilterFunction<T>;
  searchFields?: (keyof T)[];
  defaultDebounceMs?: number;
}

interface UseFilterResult<T> {
  filteredData: T[];
  setFilter: (
    filterFn: FilterFunction<T> | string,
    options?: FilterOptions
  ) => void;
  resetFilter: () => void;
  searchTerm: string;
  isFiltered: boolean;
}

interface FilterOptions {
  debounceMs?: number;
}

/**
 * A React hook that provides filtering capabilities for arrays of data.
 * Supports both custom filter functions and text-based filtering.
 *
 * @template T The type of items in the array being filtered
 *
 * @param data The array of data to filter
 * @param initialFilter An optional initial filter function to apply
 *
 * @returns Object containing the filtered data and helper functions
 *
 * @example
 * ```typescript
 * // Basic usage
 * const { filteredData, setFilter } = useFilter(items);
 *
 * // Filter with custom function
 * setFilter(item => item.name.includes('John'));
 *
 * // Filter by text search
 * setFilter('search term');
 *
 * // Reset filter
 * resetFilter();
 * ```
 */
function useFilter<T>(
  data: T[],
  options: UseFilterOptions<T> = {}
): UseFilterResult<T> {
  const { initialFilter, searchFields, defaultDebounceMs = 0 } = options;
  const [filterFn, setFilterFn] = useState<FilterFunction<T> | null>(
    initialFilter || null
  );
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [debounceTimer, setDebounceTimer] = useState<NodeJS.Timeout | null>(
    null
  );

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (debounceTimer) {
        clearTimeout(debounceTimer);
      }
    };
  }, [debounceTimer]);

  const setFilter = (
    filter: FilterFunction<T> | string,
    options: FilterOptions = {}
  ) => {
    const { debounceMs = defaultDebounceMs } = options;

    // Clear previous timer
    if (debounceTimer) {
      clearTimeout(debounceTimer);
      setDebounceTimer(null);
    }

    if (typeof filter === 'string') {
      // Handle text-based filtering
      if (debounceMs > 0) {
        const timer = setTimeout(() => {
          setSearchTerm(filter);
          setFilterFn(null);
        }, debounceMs);
        setDebounceTimer(timer);
      } else {
        setSearchTerm(filter);
        setFilterFn(null);
      }
    } else if (typeof filter === 'function') {
      setFilterFn(filter);
      setSearchTerm('');
    }
  };

  const resetFilter = () => {
    setFilterFn(null);
    setSearchTerm('');
    if (debounceTimer) {
      clearTimeout(debounceTimer);
      setDebounceTimer(null);
    }
  };

  const filteredData = useMemo(() => {
    if (searchTerm) {
      const lowerSearchTerm = searchTerm.toLowerCase().trim();
      if (!lowerSearchTerm) return data;

      return data.filter((item) => {
        // Use specified search fields if provided
        if (searchFields) {
          return searchFields.some((field) =>
            String(item[field]).toLowerCase().includes(lowerSearchTerm)
          );
        }

        // Fallback to current behavior
        if (typeof item === 'string' || typeof item === 'number') {
          return String(item).toLowerCase().includes(lowerSearchTerm);
        }

        if (typeof item === 'object' && item !== null) {
          return Object.values(item).some((value) =>
            String(value).toLowerCase().includes(lowerSearchTerm)
          );
        }

        return false;
      });
    }

    return filterFn ? data.filter(filterFn) : data;
  }, [data, searchTerm, filterFn, searchFields]);

  const isFiltered = filterFn !== null || searchTerm !== '';

  return {
    filteredData,
    setFilter,
    resetFilter,
    searchTerm,
    isFiltered,
  };
}

export default useFilter;
