/**
 * Unit tests for the generic wizard state machine hook.
 * Tests the pure reducer logic for step navigation, data management,
 * loading states, and error handling.
 */
import { describe, it, expect } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useWizardMachine } from "@/components/wizards/use-wizard-machine";

type TestStep = "step1" | "step2" | "step3";

interface TestData {
  name: string;
  value: number;
  selected: boolean;
}

describe("useWizardMachine", () => {
  describe("initialization", () => {
    it("initializes with the provided initial step", () => {
      const { result } = renderHook(() =>
        useWizardMachine<TestStep, TestData>("step1")
      );

      expect(result.current.state.currentStep).toBe("step1");
      expect(result.current.state.stepHistory).toEqual([]);
      expect(result.current.state.data).toEqual({});
      expect(result.current.state.loadingStates).toEqual({});
      expect(result.current.state.error).toBeNull();
    });

    it("initializes with provided initial data", () => {
      const initialData: Partial<TestData> = { name: "test", value: 42 };
      const { result } = renderHook(() =>
        useWizardMachine<TestStep, TestData>("step1", initialData)
      );

      expect(result.current.state.data).toEqual(initialData);
    });
  });

  describe("navigation", () => {
    it("advances to next step and records history", () => {
      const { result } = renderHook(() =>
        useWizardMachine<TestStep, TestData>("step1")
      );

      act(() => {
        result.current.actions.next("step2");
      });

      expect(result.current.state.currentStep).toBe("step2");
      expect(result.current.state.stepHistory).toEqual(["step1"]);
    });

    it("merges data when advancing to next step", () => {
      const { result } = renderHook(() =>
        useWizardMachine<TestStep, TestData>("step1", { name: "initial" })
      );

      act(() => {
        result.current.actions.next("step2", { value: 100 });
      });

      expect(result.current.state.data).toEqual({
        name: "initial",
        value: 100,
      });
    });

    it("goes back to previous step from history", () => {
      const { result } = renderHook(() =>
        useWizardMachine<TestStep, TestData>("step1")
      );

      act(() => {
        result.current.actions.next("step2");
        result.current.actions.next("step3");
      });

      expect(result.current.state.currentStep).toBe("step3");
      expect(result.current.state.stepHistory).toEqual(["step1", "step2"]);

      act(() => {
        result.current.actions.back();
      });

      expect(result.current.state.currentStep).toBe("step2");
      expect(result.current.state.stepHistory).toEqual(["step1"]);
    });

    it("does nothing on back when history is empty", () => {
      const { result } = renderHook(() =>
        useWizardMachine<TestStep, TestData>("step1")
      );

      act(() => {
        result.current.actions.back();
      });

      expect(result.current.state.currentStep).toBe("step1");
      expect(result.current.state.stepHistory).toEqual([]);
    });

    it("skips to target step and records history", () => {
      const { result } = renderHook(() =>
        useWizardMachine<TestStep, TestData>("step1")
      );

      act(() => {
        result.current.actions.skipTo("step3");
      });

      expect(result.current.state.currentStep).toBe("step3");
      expect(result.current.state.stepHistory).toEqual(["step1"]);
    });

    it("resets to initial state", () => {
      const { result } = renderHook(() =>
        useWizardMachine<TestStep, TestData>("step1", { name: "initial" })
      );

      act(() => {
        result.current.actions.next("step2", { value: 42 });
        result.current.actions.setError("Some error");
        result.current.actions.setLoading("test", true);
      });

      act(() => {
        result.current.actions.reset();
      });

      expect(result.current.state.currentStep).toBe("step1");
      expect(result.current.state.stepHistory).toEqual([]);
      expect(result.current.state.data).toEqual({});
      expect(result.current.state.loadingStates).toEqual({});
      expect(result.current.state.error).toBeNull();
    });

    it("reports canGoBack correctly", () => {
      const { result } = renderHook(() =>
        useWizardMachine<TestStep, TestData>("step1")
      );

      expect(result.current.canGoBack).toBe(false);

      act(() => {
        result.current.actions.next("step2");
      });

      expect(result.current.canGoBack).toBe(true);

      act(() => {
        result.current.actions.back();
      });

      expect(result.current.canGoBack).toBe(false);
    });
  });

  describe("data management", () => {
    it("merges data on SET_DATA action", () => {
      const { result } = renderHook(() =>
        useWizardMachine<TestStep, TestData>("step1", { name: "initial" })
      );

      act(() => {
        result.current.actions.setData({ value: 42 });
      });

      expect(result.current.state.data).toEqual({ name: "initial", value: 42 });
    });

    it("preserves existing data when merging", () => {
      const { result } = renderHook(() =>
        useWizardMachine<TestStep, TestData>("step1", {
          name: "test",
          value: 10,
          selected: true,
        })
      );

      act(() => {
        result.current.actions.setData({ value: 20 });
      });

      expect(result.current.state.data).toEqual({
        name: "test",
        value: 20,
        selected: true,
      });
    });

    it("allows setting data to undefined values", () => {
      const { result } = renderHook(() =>
        useWizardMachine<TestStep, TestData>("step1", { name: "test" })
      );

      act(() => {
        result.current.actions.setData({
          name: undefined as unknown as string,
        });
      });

      expect(result.current.state.data.name).toBeUndefined();
    });
  });

  describe("loading states", () => {
    it("sets loading state by key", () => {
      const { result } = renderHook(() =>
        useWizardMachine<TestStep, TestData>("step1")
      );

      act(() => {
        result.current.actions.setLoading("fetch-data", true);
      });

      expect(result.current.state.loadingStates["fetch-data"]).toBe(true);
      expect(result.current.isLoading("fetch-data")).toBe(true);
    });

    it("tracks multiple loading states independently", () => {
      const { result } = renderHook(() =>
        useWizardMachine<TestStep, TestData>("step1")
      );

      act(() => {
        result.current.actions.setLoading("fetch-data", true);
        result.current.actions.setLoading("save-data", true);
      });

      expect(result.current.isLoading("fetch-data")).toBe(true);
      expect(result.current.isLoading("save-data")).toBe(true);

      act(() => {
        result.current.actions.setLoading("fetch-data", false);
      });

      expect(result.current.isLoading("fetch-data")).toBe(false);
      expect(result.current.isLoading("save-data")).toBe(true);
    });

    it("isLoading returns false for unknown keys", () => {
      const { result } = renderHook(() =>
        useWizardMachine<TestStep, TestData>("step1")
      );

      expect(result.current.isLoading("unknown-key")).toBe(false);
    });
  });

  describe("error handling", () => {
    it("sets error message", () => {
      const { result } = renderHook(() =>
        useWizardMachine<TestStep, TestData>("step1")
      );

      act(() => {
        result.current.actions.setError("Something went wrong");
      });

      expect(result.current.state.error).toBe("Something went wrong");
    });

    it("clears error on navigation (NEXT)", () => {
      const { result } = renderHook(() =>
        useWizardMachine<TestStep, TestData>("step1")
      );

      act(() => {
        result.current.actions.setError("Some error");
      });

      expect(result.current.state.error).toBe("Some error");

      act(() => {
        result.current.actions.next("step2");
      });

      expect(result.current.state.error).toBeNull();
    });

    it("clears error on navigation (BACK)", () => {
      const { result } = renderHook(() =>
        useWizardMachine<TestStep, TestData>("step1")
      );

      act(() => {
        result.current.actions.next("step2");
        result.current.actions.setError("Some error");
      });

      act(() => {
        result.current.actions.back();
      });

      expect(result.current.state.error).toBeNull();
    });

    it("clears error on navigation (SKIP_TO)", () => {
      const { result } = renderHook(() =>
        useWizardMachine<TestStep, TestData>("step1")
      );

      act(() => {
        result.current.actions.setError("Some error");
        result.current.actions.skipTo("step3");
      });

      expect(result.current.state.error).toBeNull();
    });

    it("clears error on reset", () => {
      const { result } = renderHook(() =>
        useWizardMachine<TestStep, TestData>("step1")
      );

      act(() => {
        result.current.actions.setError("Some error");
        result.current.actions.reset();
      });

      expect(result.current.state.error).toBeNull();
    });

    it("allows clearing error explicitly", () => {
      const { result } = renderHook(() =>
        useWizardMachine<TestStep, TestData>("step1")
      );

      act(() => {
        result.current.actions.setError("Some error");
      });

      act(() => {
        result.current.actions.setError(null);
      });

      expect(result.current.state.error).toBeNull();
    });
  });

  describe("complex workflows", () => {
    it("handles a complete wizard flow", () => {
      const { result } = renderHook(() =>
        useWizardMachine<TestStep, TestData>("step1")
      );

      // Step 1: Enter name
      act(() => {
        result.current.actions.setData({ name: "Test Item" });
        result.current.actions.next("step2");
      });

      expect(result.current.state.currentStep).toBe("step2");
      expect(result.current.state.data.name).toBe("Test Item");

      // Step 2: Enter value
      act(() => {
        result.current.actions.next("step3", { value: 42 });
      });

      expect(result.current.state.currentStep).toBe("step3");
      expect(result.current.state.data).toEqual({
        name: "Test Item",
        value: 42,
      });

      // Go back and change
      act(() => {
        result.current.actions.back();
      });

      expect(result.current.state.currentStep).toBe("step2");

      act(() => {
        result.current.actions.next("step3", { value: 100 });
      });

      expect(result.current.state.data.value).toBe(100);
    });

    it("handles async operation pattern", async () => {
      const { result } = renderHook(() =>
        useWizardMachine<TestStep, TestData>("step1")
      );

      // Simulate async operation
      act(() => {
        result.current.actions.setLoading("fetch", true);
        result.current.actions.setError(null);
      });

      expect(result.current.isLoading("fetch")).toBe(true);

      // Simulate success
      act(() => {
        result.current.actions.setData({ name: "Fetched Data" });
        result.current.actions.setLoading("fetch", false);
      });

      expect(result.current.isLoading("fetch")).toBe(false);
      expect(result.current.state.data.name).toBe("Fetched Data");
    });

    it("handles async error pattern", async () => {
      const { result } = renderHook(() =>
        useWizardMachine<TestStep, TestData>("step1")
      );

      // Simulate async operation
      act(() => {
        result.current.actions.setLoading("fetch", true);
      });

      // Simulate failure
      act(() => {
        result.current.actions.setLoading("fetch", false);
        result.current.actions.setError("Network error");
      });

      expect(result.current.isLoading("fetch")).toBe(false);
      expect(result.current.state.error).toBe("Network error");
    });
  });
});
