import { useState, useRef, useCallback, useEffect } from "react";

/**
 * Debounced search state — returns both the immediate input value
 * (for the TextInput) and the debounced value (for queries).
 */
export function useDebouncedSearch(delayMs = 300) {
  const [inputValue, setInputValue] = useState("");
  const [debouncedValue, setDebouncedValue] = useState("");
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const setValue = useCallback(
    (text: string) => {
      setInputValue(text);
      if (timerRef.current) clearTimeout(timerRef.current);
      timerRef.current = setTimeout(() => setDebouncedValue(text), delayMs);
    },
    [delayMs]
  );

  const clear = useCallback(() => {
    setInputValue("");
    setDebouncedValue("");
    if (timerRef.current) clearTimeout(timerRef.current);
  }, []);

  useEffect(() => {
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, []);

  return { inputValue, debouncedValue, setValue, clear } as const;
}
