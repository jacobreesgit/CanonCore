"use client";

import { useQueryState, parseAsString, debounce, defaultRateLimit } from "nuqs";
import { useCallback } from "react";

/**
 * Manages search query URL state with debouncing.
 * Uses nuqs built-in debounce — local state updates instantly,
 * URL updates are debounced. No manual sync effects needed.
 */
export function useSearchParam(paramName = "q", debounceMs = 300) {
  const [value, setValue] = useQueryState(
    paramName,
    parseAsString.withDefault("").withOptions({
      history: "replace",
      scroll: false,
      shallow: true,
      limitUrlUpdates: debounce(debounceMs),
    })
  );

  const setInputValue = useCallback(
    (v: string) => setValue(v || null),
    [setValue]
  );

  const clear = useCallback(
    () => setValue(null, { limitUrlUpdates: defaultRateLimit }),
    [setValue]
  );

  return {
    inputValue: value,
    /** URL-committed value (same as inputValue — nuqs handles debounce internally). */
    committedValue: value,
    setInputValue,
    clear,
  };
}
