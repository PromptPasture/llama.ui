import { useState, useEffect, useRef, useCallback } from 'react';

function useFrameRateLimit<T>(value: T, targetFPS: number = 25) {
  const [displayedValue, setDisplayedValue] = useState<T>(value);
  const targetFrameTime = 1000 / targetFPS; // ms per frame
  const lastFrameTimeRef = useRef<number>(0);
  const pendingValueRef = useRef<T | null>(null);
  const animationFrameRef = useRef<number>(0);

  const updateFrame = useCallback(
    (timestamp: number) => {
      if (timestamp - lastFrameTimeRef.current >= targetFrameTime) {
        if (pendingValueRef.current !== null) {
          setDisplayedValue(pendingValueRef.current);
          pendingValueRef.current = null;
          lastFrameTimeRef.current = timestamp;
        }
      }

      animationFrameRef.current = requestAnimationFrame(updateFrame);
    },
    [targetFrameTime]
  );

  useEffect(() => {
    pendingValueRef.current = value;

    if (!animationFrameRef.current) {
      animationFrameRef.current = requestAnimationFrame(updateFrame);
    }

    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, [value, updateFrame]);

  return displayedValue;
}

export default useFrameRateLimit;
