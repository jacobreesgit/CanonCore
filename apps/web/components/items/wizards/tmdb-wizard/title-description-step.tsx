/**
 * Wizard step for selecting title and description updates.
 * Displays checkboxes with before/after preview from Phase A.
 */

"use client";

import { useCallback } from "react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faArrowRight } from "@fortawesome/free-solid-svg-icons";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";

/**
 * Current item values for comparison.
 */
export interface CurrentTextValues {
  /** Current item name */
  name: string;
  /** Current item description */
  description: string | null;
}

/**
 * TMDB text preview data.
 */
export interface TextPreviewData {
  /** Formatted name with year from TMDB */
  name: string;
  /** Truncated overview from TMDB */
  description: string;
}

/**
 * Options for title/description step.
 */
export interface TitleDescriptionOptions {
  /** Whether to update the item name */
  updateName: boolean;
  /** Whether to update the item description */
  updateDescription: boolean;
}

interface TitleDescriptionStepProps {
  /** Current item values */
  currentValues: CurrentTextValues;
  /** TMDB preview data */
  preview: TextPreviewData;
  /** Current options state */
  options: TitleDescriptionOptions;
  /** Callback when options change */
  onOptionsChange: (options: TitleDescriptionOptions) => void;
  /** Whether step is disabled */
  disabled?: boolean;
}

/**
 * Title and description selection step for the metadata wizard.
 * Shows checkboxes with before/after text preview.
 *
 * @param currentValues - Current item values
 * @param preview - TMDB preview data
 * @param options - Current checkbox states
 * @param onOptionsChange - Callback when checkboxes change
 * @param disabled - Whether step is disabled
 */
export function TitleDescriptionStep({
  currentValues,
  preview,
  options,
  onOptionsChange,
  disabled = false,
}: TitleDescriptionStepProps) {
  /**
   * Updates a single option.
   */
  const setOption = useCallback(
    (key: keyof TitleDescriptionOptions, value: boolean) => {
      onOptionsChange({ ...options, [key]: value });
    },
    [options, onOptionsChange]
  );

  const nameHasChange = currentValues.name !== preview.name;
  const descriptionHasChange =
    currentValues.description !== preview.description;

  return (
    <div className="space-y-4">
      {/* Name Field */}
      <TextFieldOption
        id="wizard-update-name"
        label="Name"
        checked={options.updateName}
        onCheckedChange={(checked) => setOption("updateName", checked)}
        disabled={disabled}
        currentValue={currentValues.name || "(empty)"}
        newValue={preview.name || "(empty)"}
        hasChange={nameHasChange}
      />

      <Separator />

      {/* Description Field */}
      <TextFieldOption
        id="wizard-update-description"
        label="Description"
        checked={options.updateDescription}
        onCheckedChange={(checked) => setOption("updateDescription", checked)}
        disabled={disabled}
        currentValue={currentValues.description || "(empty)"}
        newValue={preview.description || "(empty)"}
        hasChange={descriptionHasChange}
      />
    </div>
  );
}

/**
 * Props for text field option component.
 */
interface TextFieldOptionProps {
  /** Field ID for accessibility */
  id: string;
  /** Field label */
  label: string;
  /** Whether checkbox is checked */
  checked: boolean;
  /** Callback when checkbox changes */
  onCheckedChange: (checked: boolean) => void;
  /** Whether field is disabled */
  disabled?: boolean;
  /** Current value display */
  currentValue: string;
  /** New value from TMDB */
  newValue: string;
  /** Whether there's actually a change */
  hasChange: boolean;
}

/**
 * Single text field option with checkbox and before/after preview.
 */
function TextFieldOption({
  id,
  label,
  checked,
  onCheckedChange,
  disabled,
  currentValue,
  newValue,
  hasChange,
}: TextFieldOptionProps) {
  return (
    <div className="space-y-2">
      <div className="flex items-center gap-3">
        <Checkbox
          id={id}
          checked={checked}
          onCheckedChange={(val: boolean | "indeterminate") =>
            onCheckedChange(val === true)
          }
          disabled={disabled}
        />
        <Label
          htmlFor={id}
          className={cn(
            "cursor-pointer font-medium",
            disabled && "cursor-not-allowed opacity-50"
          )}
        >
          {label}
        </Label>
        {!hasChange && (
          <span className="text-muted-foreground ml-auto text-xs">
            No change
          </span>
        )}
      </div>

      {hasChange && (
        <div className="ml-7 space-y-1">
          <div className="flex items-start gap-2 text-sm">
            <span className="text-muted-foreground line-through">
              {currentValue}
            </span>
          </div>
          <div className="flex items-start gap-2 text-sm">
            <FontAwesomeIcon
              icon={faArrowRight}
              className="text-muted-foreground mt-0.5 size-3 shrink-0"
            />
            <span className="text-foreground font-medium">{newValue}</span>
          </div>
        </div>
      )}
    </div>
  );
}
