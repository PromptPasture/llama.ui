import React, { useCallback } from 'react';

/**
 * Distance from bottom (in pixels) to trigger automatic scroll when near the bottom.
 * @default 100
 */
const TO_BOTTOM = 100;

/**
 * Delay (in milliseconds) before scrolling when using `scrollImmediate`.
 * @default 80
 */
const DELAY = 80;

/**
 * Custom hook for managing chat scroll behavior in a message container.
 *
 * This is useful for chat interfaces where you want to auto-scroll when new messages arrive,
 * but avoid scrolling when the user has manually scrolled up to read older messages.
 *
 * @param options - Configuration options for the hook
 * @param options.elementRef - Ref object pointing to the chat container element
 * @param options.behavior - Scroll behavior option ('auto' or 'smooth'). Defaults to 'auto'
 */
export function useChatScroll(
  /**
   * React ref object pointing to the chat container element.
   * This element must have scrollable content (overflow-y: auto/scroll).
   */
  elementRef: React.RefObject<HTMLElement>
) {
  /**
   * Immediately scrolls the chat container to the bottom after a specified delay.
   *
   * This is typically used when new messages are added to the chat and you want to
   * auto-scroll to the bottom after a brief delay (to allow UI updates to complete).
   *
   * @param delay - Optional delay in milliseconds before scrolling. Defaults to 80ms.
   */
  const scrollImmediate = useCallback(
    (behavior: ScrollBehavior = 'auto', delay: number = DELAY) => {
      const element = elementRef?.current;
      if (!element) return;
      setTimeout(
        () => element.scrollTo({ top: element.scrollHeight, behavior }),
        delay
      );
    },
    [elementRef]
  );

  /**
   * Scrolls to the bottom of the container only if the user is near the bottom.
   *
   * This method checks the current scroll position and only scrolls to bottom if the
   * user is within `TO_BOTTOM` pixels of the bottom. This prevents unwanted scrolling
   * when the user has manually scrolled up to read older messages.
   */
  const scrollToBottom = useCallback(
    (behavior: ScrollBehavior = 'auto') => {
      const element = elementRef?.current;
      if (!element) return;

      const { scrollHeight, scrollTop, clientHeight } = element;
      const spaceToBottom = scrollHeight - scrollTop - clientHeight;
      if (spaceToBottom < TO_BOTTOM) {
        element.scrollTo({ top: element.scrollHeight, behavior });
      }
    },
    [elementRef]
  );

  return { scrollImmediate, scrollToBottom };
}
