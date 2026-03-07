import { describe, it, expect } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useSearchParam } from "@/hooks/use-search-param";
import { NuqsTestingAdapter } from "nuqs/adapters/testing";

describe("useSearchParam", () => {
  it("returns empty string by default", () => {
    const { result } = renderHook(() => useSearchParam(), {
      wrapper: ({ children }) => (
        <NuqsTestingAdapter>{children}</NuqsTestingAdapter>
      ),
    });
    expect(result.current.inputValue).toBe("");
    expect(result.current.committedValue).toBe("");
  });

  it("reads initial value from URL", () => {
    const { result } = renderHook(() => useSearchParam(), {
      wrapper: ({ children }) => (
        <NuqsTestingAdapter searchParams="?q=hello">
          {children}
        </NuqsTestingAdapter>
      ),
    });
    expect(result.current.inputValue).toBe("hello");
  });

  it("clears both input and URL value", () => {
    const { result } = renderHook(() => useSearchParam(), {
      wrapper: ({ children }) => (
        <NuqsTestingAdapter searchParams="?q=hello">
          {children}
        </NuqsTestingAdapter>
      ),
    });

    act(() => {
      result.current.clear();
    });

    expect(result.current.inputValue).toBe("");
  });

  it("updates inputValue immediately on setInputValue", () => {
    const { result } = renderHook(() => useSearchParam(), {
      wrapper: ({ children }) => (
        <NuqsTestingAdapter>{children}</NuqsTestingAdapter>
      ),
    });

    act(() => {
      result.current.setInputValue("test");
    });

    expect(result.current.inputValue).toBe("test");
  });
});
