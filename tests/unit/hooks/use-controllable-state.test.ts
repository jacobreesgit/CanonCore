/**
 * Unit tests for useControllableState hook.
 */

import { renderHook, act } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { useControllableState } from "@/hooks/use-controllable-state";

describe("useControllableState", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("uncontrolled mode", () => {
    it("uses defaultValue as initial value", () => {
      const { result } = renderHook(() =>
        useControllableState({
          defaultValue: "initial",
        })
      );

      expect(result.current[0]).toBe("initial");
    });

    it("updates internal state on setValue", () => {
      const { result } = renderHook(() =>
        useControllableState({
          defaultValue: 0,
        })
      );

      act(() => {
        result.current[1](5);
      });

      expect(result.current[0]).toBe(5);
    });

    it("handles functional updates", () => {
      const { result } = renderHook(() =>
        useControllableState({
          defaultValue: 10,
        })
      );

      act(() => {
        result.current[1]((prev) => prev + 5);
      });

      expect(result.current[0]).toBe(15);
    });

    it("calls onChange when provided in uncontrolled mode", () => {
      const onChange = vi.fn();
      const { result } = renderHook(() =>
        useControllableState({
          defaultValue: "a",
          onChange,
        })
      );

      act(() => {
        result.current[1]("b");
      });

      expect(onChange).toHaveBeenCalledWith("b");
      expect(result.current[0]).toBe("b");
    });

    it("calls onChange with resolved value for functional updates", () => {
      const onChange = vi.fn();
      const { result } = renderHook(() =>
        useControllableState({
          defaultValue: 1,
          onChange,
        })
      );

      act(() => {
        result.current[1]((prev) => prev * 2);
      });

      expect(onChange).toHaveBeenCalledWith(2);
    });
  });

  describe("controlled mode", () => {
    it("uses provided value instead of defaultValue", () => {
      const { result } = renderHook(() =>
        useControllableState({
          value: "controlled",
          defaultValue: "default",
        })
      );

      expect(result.current[0]).toBe("controlled");
    });

    it("updates when controlled value changes", () => {
      const { result, rerender } = renderHook(
        ({ value }) =>
          useControllableState({
            value,
            defaultValue: "default",
          }),
        { initialProps: { value: "first" } }
      );

      expect(result.current[0]).toBe("first");

      rerender({ value: "second" });

      expect(result.current[0]).toBe("second");
    });

    it("calls onChange but does not update internal state", () => {
      const onChange = vi.fn();
      const { result } = renderHook(() =>
        useControllableState({
          value: "controlled",
          defaultValue: "default",
          onChange,
        })
      );

      act(() => {
        result.current[1]("new-value");
      });

      // onChange should be called
      expect(onChange).toHaveBeenCalledWith("new-value");
      // But value should still be the controlled value
      expect(result.current[0]).toBe("controlled");
    });

    it("handles functional updates with controlled value", () => {
      const onChange = vi.fn();
      const { result } = renderHook(() =>
        useControllableState({
          value: 10,
          defaultValue: 0,
          onChange,
        })
      );

      act(() => {
        result.current[1]((prev) => prev + 5);
      });

      // Should resolve with controlled value
      expect(onChange).toHaveBeenCalledWith(15);
    });

    it("reflects external value changes from onChange handler", () => {
      let externalValue = "initial";
      const onChange = vi.fn((newValue) => {
        externalValue = newValue;
      });

      const { result, rerender } = renderHook(
        ({ value }) =>
          useControllableState({
            value,
            defaultValue: "",
            onChange,
          }),
        { initialProps: { value: externalValue } }
      );

      expect(result.current[0]).toBe("initial");

      // Simulate user interaction
      act(() => {
        result.current[1]("updated");
      });

      expect(onChange).toHaveBeenCalledWith("updated");

      // Simulate parent re-rendering with new value
      rerender({ value: externalValue });

      expect(result.current[0]).toBe("updated");
    });
  });

  describe("edge cases", () => {
    it("handles undefined value as uncontrolled", () => {
      const { result } = renderHook(() =>
        useControllableState({
          value: undefined,
          defaultValue: "uncontrolled",
        })
      );

      expect(result.current[0]).toBe("uncontrolled");

      act(() => {
        result.current[1]("new");
      });

      expect(result.current[0]).toBe("new");
    });

    it("handles null value as controlled", () => {
      const onChange = vi.fn();
      const { result } = renderHook(() =>
        useControllableState<string | null>({
          value: null,
          defaultValue: "default",
          onChange,
        })
      );

      expect(result.current[0]).toBeNull();
    });

    it("handles boolean values", () => {
      const onChange = vi.fn();
      const { result } = renderHook(() =>
        useControllableState({
          value: false,
          defaultValue: true,
          onChange,
        })
      );

      expect(result.current[0]).toBe(false);

      act(() => {
        result.current[1](true);
      });

      expect(onChange).toHaveBeenCalledWith(true);
    });

    it("handles object values", () => {
      const onChange = vi.fn();
      const { result } = renderHook(() =>
        useControllableState({
          defaultValue: { count: 0 },
          onChange,
        })
      );

      act(() => {
        result.current[1]((prev) => ({ count: prev.count + 1 }));
      });

      expect(result.current[0]).toEqual({ count: 1 });
      expect(onChange).toHaveBeenCalledWith({ count: 1 });
    });

    it("handles array values", () => {
      const { result } = renderHook(() =>
        useControllableState({
          defaultValue: [1, 2, 3],
        })
      );

      act(() => {
        result.current[1]((prev) => [...prev, 4]);
      });

      expect(result.current[0]).toEqual([1, 2, 3, 4]);
    });

    it("does not call onChange when not provided", () => {
      const { result } = renderHook(() =>
        useControllableState({
          defaultValue: "a",
        })
      );

      // Should not throw
      act(() => {
        result.current[1]("b");
      });

      expect(result.current[0]).toBe("b");
    });

    it("maintains stable setValue reference", () => {
      const { result, rerender } = renderHook(() =>
        useControllableState({
          defaultValue: 0,
        })
      );

      const firstSetValue = result.current[1];

      rerender();

      expect(result.current[1]).toBe(firstSetValue);
    });
  });
});
