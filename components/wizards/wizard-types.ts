/**
 * Generic types for the wizard state machine infrastructure.
 * Provides type-safe step navigation, data accumulation, and loading state management.
 */

/**
 * Represents the current state of a wizard.
 *
 * @template TStep - Union type of valid step identifiers (e.g., "text" | "poster" | "hero")
 * @template TData - Interface describing the wizard's accumulated data
 */
export interface WizardState<TStep extends string, TData> {
  /** The currently active step */
  currentStep: TStep;
  /** History of visited steps for back navigation */
  stepHistory: TStep[];
  /** Accumulated data across all wizard steps */
  data: Partial<TData>;
  /** Per-key loading states for async operations */
  loadingStates: Record<string, boolean>;
  /** Current error message, if any */
  error: string | null;
}

/**
 * Actions that can be dispatched to the wizard reducer.
 *
 * @template TStep - Union type of valid step identifiers
 * @template TData - Interface describing the wizard's accumulated data
 */
export type WizardAction<TStep extends string, TData> =
  | { type: "NEXT"; step: TStep; data?: Partial<TData> }
  | { type: "BACK" }
  | { type: "SKIP_TO"; step: TStep }
  | { type: "SET_DATA"; payload: Partial<TData> }
  | { type: "SET_LOADING"; key: string; loading: boolean }
  | { type: "SET_ERROR"; error: string | null }
  | { type: "RESET" };

/**
 * Convenience type for wizard action helpers returned by useWizardMachine.
 *
 * @template TStep - Union type of valid step identifiers
 * @template TData - Interface describing the wizard's accumulated data
 */
export interface WizardActions<TStep extends string, TData> {
  /** Advance to the next step, optionally merging data */
  next: (step: TStep, data?: Partial<TData>) => void;
  /** Go back to the previous step from history */
  back: () => void;
  /** Skip directly to a target step */
  skipTo: (step: TStep) => void;
  /** Merge additional data into the wizard state */
  setData: (payload: Partial<TData>) => void;
  /** Set a loading state by key */
  setLoading: (key: string, loading: boolean) => void;
  /** Set or clear the error message */
  setError: (error: string | null) => void;
  /** Reset the wizard to its initial state */
  reset: () => void;
}

/**
 * Return type of the useWizardMachine hook.
 *
 * @template TStep - Union type of valid step identifiers
 * @template TData - Interface describing the wizard's accumulated data
 */
export interface UseWizardMachineReturn<TStep extends string, TData> {
  /** Current wizard state */
  state: WizardState<TStep, TData>;
  /** Action dispatchers for state transitions */
  actions: WizardActions<TStep, TData>;
  /** Check if a specific operation is loading */
  isLoading: (key: string) => boolean;
  /** Whether back navigation is possible */
  canGoBack: boolean;
  /** Raw dispatch function for advanced use cases */
  dispatch: React.Dispatch<WizardAction<TStep, TData>>;
}
