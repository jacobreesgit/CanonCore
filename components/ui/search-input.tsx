"use client";

import { useState, useEffect, useCallback } from "react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faMagnifyingGlass, faXmark } from "@fortawesome/free-solid-svg-icons";
import { cn } from "@/lib/utils";

interface SearchInputProps {
  value: string;
  onChange: (value: string) => void;
  /** Called when the clear button is clicked. Falls back to onChange("") if not provided. */
  onClear?: () => void;
  placeholder?: string;
  className?: string;
  /** Test ID for disambiguation when multiple search inputs exist on a page. */
  testId?: string;
}

export function SearchInput({
  value,
  onChange,
  onClear,
  placeholder = "Search\u2026",
  className,
  testId,
}: SearchInputProps) {
  return (
    <div className={cn("relative", className)} data-testid={testId}>
      <FontAwesomeIcon
        icon={faMagnifyingGlass}
        className="text-muted-foreground absolute top-1/2 left-3 h-3.5 w-3.5 -translate-y-1/2"
        aria-hidden="true"
      />
      <input
        type="search"
        role="searchbox"
        aria-label="Search"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        autoComplete="off"
        spellCheck={false}
        className="placeholder:text-muted-foreground focus-visible:ring-ring h-9 w-full rounded-md border border-[var(--glass-border)] bg-[var(--glass-bg)] py-2 pr-9 pl-9 text-sm transition-colors focus-visible:ring-1 focus-visible:outline-none [&::-webkit-search-cancel-button]:hidden [&::-webkit-search-decoration]:hidden"
      />
      {value && (
        <button
          type="button"
          onClick={() => (onClear ? onClear() : onChange(""))}
          aria-label="Clear search"
          className="text-muted-foreground hover:text-foreground absolute top-1/2 right-3 -translate-y-1/2 transition-colors"
        >
          <FontAwesomeIcon icon={faXmark} className="h-3.5 w-3.5" />
        </button>
      )}
    </div>
  );
}

/**
 * Self-contained search input that owns its own state and debounces
 * the committed value. Prevents parent re-renders on every keystroke.
 *
 * Use this instead of SearchInput when the parent component is expensive
 * to re-render (e.g. owner profile with 35+ grid items).
 */
interface DebouncedSearchInputProps {
  /** Committed (debounced) value — drives the parent's filtering. */
  value: string;
  /** Called with the debounced value (not on every keystroke). */
  onValueCommit: (value: string) => void;
  placeholder?: string;
  className?: string;
  /** Debounce delay in ms (default: 150). */
  debounceMs?: number;
}

export function DebouncedSearchInput({
  value,
  onValueCommit,
  placeholder,
  className,
  debounceMs = 150,
}: DebouncedSearchInputProps) {
  const [local, setLocal] = useState(value);
  const [prevValue, setPrevValue] = useState(value);

  // Sync external resets (adjust state during render pattern)
  if (value !== prevValue) {
    setPrevValue(value);
    if (local !== value) setLocal(value);
  }

  // Debounce: local → committed
  useEffect(() => {
    if (local === value) return;
    const timer = setTimeout(() => onValueCommit(local), debounceMs);
    return () => clearTimeout(timer);
  }, [local, value, debounceMs, onValueCommit]);

  const handleClear = useCallback(() => {
    setLocal("");
    onValueCommit("");
  }, [onValueCommit]);

  return (
    <SearchInput
      value={local}
      onChange={setLocal}
      onClear={handleClear}
      placeholder={placeholder}
      className={className}
    />
  );
}
