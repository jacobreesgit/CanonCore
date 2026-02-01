/**
 * Accessible step indicator component for wizard flows.
 * Displays visual progress through wizard steps with WCAG 2.1 Level A compliance.
 */
"use client";

import { cn } from "@/lib/utils";
import { Check } from "lucide-react";

type StepState = "completed" | "current" | "upcoming";

interface WizardStepIndicatorProps<TStep extends string> {
  /** Ordered array of step identifiers */
  steps: readonly TStep[];
  /** Currently active step */
  currentStep: TStep;
  /** Human-readable labels for each step */
  stepLabels: Record<TStep, string>;
  /** Optional additional className for the nav element */
  className?: string;
}

/**
 * Determines the state of a step based on its position relative to the current step.
 *
 * @param stepIndex - The index of the step to check
 * @param currentIndex - The index of the current step
 * @returns The state of the step
 */
function getStepState(stepIndex: number, currentIndex: number): StepState {
  if (stepIndex < currentIndex) return "completed";
  if (stepIndex === currentIndex) return "current";
  return "upcoming";
}

/**
 * Generates the aria-label for a step including its state.
 *
 * @param index - Zero-based index of the step
 * @param label - Human-readable label for the step
 * @param state - Current state of the step
 * @returns Accessible label string
 */
function getStepAriaLabel(
  index: number,
  label: string,
  state: StepState
): string {
  return `Step ${index + 1}: ${label}, ${state}`;
}

/**
 * A step indicator that shows progress through a wizard flow.
 * Fully accessible with proper ARIA attributes and live region announcements.
 *
 * @param steps - Ordered array of step identifiers
 * @param currentStep - The currently active step
 * @param stepLabels - Human-readable labels for each step
 * @param className - Optional additional className
 *
 * @example
 * <WizardStepIndicator
 *   steps={["text", "poster", "hero", "summary"]}
 *   currentStep="poster"
 *   stepLabels={{
 *     text: "Title & Description",
 *     poster: "Poster",
 *     hero: "Hero Image",
 *     summary: "Review",
 *   }}
 * />
 */
export function WizardStepIndicator<TStep extends string>({
  steps,
  currentStep,
  stepLabels,
  className,
}: WizardStepIndicatorProps<TStep>) {
  const currentIndex = steps.indexOf(currentStep);
  const totalSteps = steps.length;

  return (
    <>
      {/* Live region for screen reader announcements */}
      <div
        role="status"
        aria-live="polite"
        aria-atomic="true"
        className="sr-only"
      >
        Step {currentIndex + 1} of {totalSteps}: {stepLabels[currentStep]}
      </div>

      <nav aria-label="Wizard progress" className={cn("w-full", className)}>
        <ol role="list" className="flex items-center justify-between gap-2">
          {steps.map((step, index) => {
            const state = getStepState(index, currentIndex);
            const label = stepLabels[step];

            return (
              <li
                key={step}
                data-state={state}
                aria-current={state === "current" ? "step" : undefined}
                aria-label={getStepAriaLabel(index, label, state)}
                className="relative flex flex-1 flex-col items-center gap-2"
              >
                {/* Step circle */}
                <div
                  className={cn(
                    "flex h-8 w-8 items-center justify-center rounded-full border-2 text-sm font-medium transition-colors",
                    state === "completed" &&
                      "border-primary bg-primary text-primary-foreground",
                    state === "current" &&
                      "border-primary bg-background text-primary",
                    state === "upcoming" &&
                      "border-muted-foreground/30 bg-background text-muted-foreground"
                  )}
                >
                  {state === "completed" ? (
                    <Check className="h-4 w-4" aria-hidden="true" />
                  ) : (
                    <span>{index + 1}</span>
                  )}
                </div>

                {/* Step label */}
                <span
                  className={cn(
                    "text-center text-xs font-medium transition-colors",
                    state === "completed" && "text-primary",
                    state === "current" && "text-foreground",
                    state === "upcoming" && "text-muted-foreground"
                  )}
                >
                  {label}
                </span>

                {/* Connector line (except for last item) */}
                {index < steps.length - 1 && (
                  <div
                    className={cn(
                      "absolute top-4 left-[calc(50%+1rem)] h-0.5 w-[calc(100%-2rem)] -translate-y-1/2",
                      state === "completed" ? "bg-primary" : "bg-muted"
                    )}
                    aria-hidden="true"
                  />
                )}
              </li>
            );
          })}
        </ol>
      </nav>
    </>
  );
}
