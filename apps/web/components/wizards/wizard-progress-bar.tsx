/**
 * Compact wizard progress bar with screen reader announcements.
 * Replaces the old WizardStepIndicator with a minimal segmented bar
 * and sr-only live region for accessibility.
 */

import { cn } from "@/lib/utils";

interface WizardProgressBarProps<TStep extends string> {
  /** Ordered array of step IDs. */
  steps: TStep[];
  /** Currently active step ID. */
  currentStep: TStep;
  /** Human-readable labels keyed by step ID. */
  stepLabels: Record<TStep, string>;
}

/**
 * Segmented progress bar for multi-step wizards.
 * Renders a visual bar (aria-hidden) paired with an sr-only live region
 * that announces the current step to screen readers.
 *
 * @param steps - Ordered step IDs
 * @param currentStep - Active step
 * @param stepLabels - Display labels per step
 */
export function WizardProgressBar<TStep extends string>({
  steps,
  currentStep,
  stepLabels,
}: WizardProgressBarProps<TStep>) {
  const currentIndex = steps.indexOf(currentStep);

  return (
    <>
      <div
        role="status"
        aria-live="polite"
        aria-atomic="true"
        className="sr-only"
      >
        Step {currentIndex + 1} of {steps.length}: {stepLabels[currentStep]}
      </div>
      <div className="mt-3 flex gap-1.5" aria-hidden="true">
        {steps.map((step, i) => (
          <div
            key={step}
            className={cn(
              "h-1 flex-1 rounded-full transition-colors duration-300",
              i <= currentIndex ? "bg-brand" : "bg-white/10"
            )}
          />
        ))}
      </div>
    </>
  );
}
