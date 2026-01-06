/**
 * Custom hook for controlled/uncontrolled component state pattern.
 * Allows a component to work both as controlled (value/onChange from parent)
 * and uncontrolled (internal state management).
 */

import { useState, useCallback, useRef, useEffect } from "react";

type SetStateAction<T> = T | ((prevState: T) => T);

interface UseControllableStateProps<T> {
  /** External controlled value (optional). */
  value?: T;
  /** Default value for uncontrolled mode. */
  defaultValue: T;
  /** Callback when value changes (for controlled mode). */
  onChange?: (value: T) => void;
}

/**
 * Hook for components that support both controlled and uncontrolled modes.
 *
 * When `value` is provided, the component is controlled and `onChange` is called on updates.
 * When `value` is undefined, the component manages its own internal state.
 *
 * @param value - External controlled value (optional)
 * @param defaultValue - Initial value for uncontrolled mode
 * @param onChange - Callback when value changes
 * @returns Tuple of [currentValue, setValue] similar to useState
 *
 * @example
 * ```tsx
 * function MyComponent({ isOpen, onOpenChange }: Props) {
 *   const [open, setOpen] = useControllableState({
 *     value: isOpen,
 *     defaultValue: false,
 *     onChange: onOpenChange,
 *   });
 *
 *   return <button onClick={() => setOpen(prev => !prev)}>Toggle</button>;
 * }
 * ```
 */
export function useControllableState<T>({
  value: controlledValue,
  defaultValue,
  onChange,
}: UseControllableStateProps<T>): [T, (value: SetStateAction<T>) => void] {
  const [internalValue, setInternalValue] = useState<T>(defaultValue);

  // Use controlled value if provided, otherwise use internal state
  const isControlled = controlledValue !== undefined;
  const value = isControlled ? controlledValue : internalValue;

  // Store latest value in ref (updated via effect to satisfy lint)
  const valueRef = useRef(value);
  useEffect(() => {
    valueRef.current = value;
  }, [value]);

  const setValue = useCallback(
    (nextValue: SetStateAction<T>) => {
      // For functional updates, use internal state setter which handles prev value correctly
      if (typeof nextValue === "function") {
        const updateFn = nextValue as (prevState: T) => T;
        setInternalValue((prev) => {
          const currentValue = isControlled ? valueRef.current : prev;
          const resolvedValue = updateFn(currentValue);
          if (onChange) {
            onChange(resolvedValue);
          }
          return isControlled ? prev : resolvedValue;
        });
      } else {
        // Direct value update
        if (onChange) {
          onChange(nextValue);
        }
        if (!isControlled) {
          setInternalValue(nextValue);
        }
      }
    },
    [onChange, isControlled]
  );

  return [value, setValue];
}
