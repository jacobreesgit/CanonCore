/**
 * Generic wizard state machine hook using useReducer.
 * Provides type-safe step navigation, data accumulation, loading states, and error handling.
 *
 * @example
 * type MyStep = "intro" | "form" | "confirm";
 * interface MyData { name: string; email: string }
 *
 * const { state, actions, isLoading, canGoBack } = useWizardMachine<MyStep, MyData>("intro");
 *
 * // Navigate
 * actions.next("form", { name: "John" });
 * actions.back();
 *
 * // Async operations
 * actions.setLoading("submit", true);
 * await submitForm(state.data);
 * actions.setLoading("submit", false);
 */
"use client";

import { useReducer, useMemo, useCallback } from "react";
import type {
  WizardState,
  WizardAction,
  WizardActions,
  UseWizardMachineReturn,
} from "./wizard-types";

/**
 * Creates a wizard reducer with the given initial step.
 * The reducer is pure and handles all state transitions.
 *
 * @param initialStep - The step to return to on reset
 * @returns A reducer function for the wizard state machine
 */
function createWizardReducer<TStep extends string, TData>(initialStep: TStep) {
  return function wizardReducer(
    state: WizardState<TStep, TData>,
    action: WizardAction<TStep, TData>
  ): WizardState<TStep, TData> {
    switch (action.type) {
      case "NEXT":
        return {
          ...state,
          currentStep: action.step,
          stepHistory: [...state.stepHistory, state.currentStep],
          data: action.data ? { ...state.data, ...action.data } : state.data,
          error: null,
        };

      case "BACK": {
        if (state.stepHistory.length === 0) return state;
        const history = [...state.stepHistory];
        const previousStep = history.pop()!;
        return {
          ...state,
          currentStep: previousStep,
          stepHistory: history,
          error: null,
        };
      }

      case "SKIP_TO":
        return {
          ...state,
          currentStep: action.step,
          stepHistory: [...state.stepHistory, state.currentStep],
          error: null,
        };

      case "SET_DATA":
        return {
          ...state,
          data: { ...state.data, ...action.payload },
        };

      case "SET_LOADING":
        return {
          ...state,
          loadingStates: {
            ...state.loadingStates,
            [action.key]: action.loading,
          },
        };

      case "SET_ERROR":
        return {
          ...state,
          error: action.error,
        };

      case "RESET":
        return {
          currentStep: initialStep,
          stepHistory: [],
          data: {},
          loadingStates: {},
          error: null,
        };

      default:
        return state;
    }
  };
}

/**
 * A generic wizard state machine hook using useReducer.
 *
 * Features:
 * - Type-safe step navigation with history-based back navigation
 * - Data accumulation across steps with merge semantics
 * - Per-key loading states for async operations
 * - Error handling with automatic clearing on navigation
 * - Reset to initial state
 *
 * @param initialStep - The starting step of the wizard
 * @param initialData - Optional initial data to populate the wizard
 * @returns Wizard state, actions, and helper functions
 *
 * @example
 * const wizard = useWizardMachine<"text" | "poster", { title: string }>("text");
 *
 * // Check loading state
 * if (wizard.isLoading("fetch")) return <Spinner />;
 *
 * // Navigate with data
 * wizard.actions.next("poster", { title: "My Item" });
 */
export function useWizardMachine<TStep extends string, TData>(
  initialStep: TStep,
  initialData: Partial<TData> = {}
): UseWizardMachineReturn<TStep, TData> {
  const reducer = useMemo(
    () => createWizardReducer<TStep, TData>(initialStep),
    [initialStep]
  );

  const [state, dispatch] = useReducer(reducer, {
    currentStep: initialStep,
    stepHistory: [],
    data: initialData,
    loadingStates: {},
    error: null,
  });

  // Empty dependency array is intentional: dispatch from useReducer is stable
  // and never changes, so these action creators never need to be recreated
  const actions: WizardActions<TStep, TData> = useMemo(
    () => ({
      next: (step: TStep, data?: Partial<TData>) =>
        dispatch({ type: "NEXT", step, data }),
      back: () => dispatch({ type: "BACK" }),
      skipTo: (step: TStep) => dispatch({ type: "SKIP_TO", step }),
      setData: (payload: Partial<TData>) =>
        dispatch({ type: "SET_DATA", payload }),
      setLoading: (key: string, loading: boolean) =>
        dispatch({ type: "SET_LOADING", key, loading }),
      setError: (error: string | null) =>
        dispatch({ type: "SET_ERROR", error }),
      reset: () => dispatch({ type: "RESET" }),
    }),
    []
  );

  const isLoading = useCallback(
    (key: string) => state.loadingStates[key] ?? false,
    [state.loadingStates]
  );

  const canGoBack = state.stepHistory.length > 0;

  return { state, actions, isLoading, canGoBack, dispatch };
}
