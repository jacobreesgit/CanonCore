/**
 * Selection footer component for TV picker.
 * Renders the primary action button based on current navigation level.
 */
"use client";

import { Button } from "@/components/ui/button";
import { getSelectionButtonLabel } from "./tv-picker-types";
import type { SelectionFooterProps } from "./tv-picker-types";

/**
 * Selection footer component.
 * Displays "Use This Show" or "Use This Season" based on current level.
 *
 * @param level - Current navigation level (show or season)
 * @param onUseSelection - Handler for the primary action
 * @param onCancel - Handler for cancel action
 * @param onBack - Handler for back navigation (not used inline, available for render prop)
 * @param isDisabled - Whether the action is disabled
 */
export function SelectionFooter({
  level,
  onUseSelection,
  onCancel,
  // onBack is available via props for render prop consumers but not used in this default footer
  onBack: _onBack,
  isDisabled = false,
}: SelectionFooterProps) {
  const buttonLabel = getSelectionButtonLabel(level);

  return (
    <div className="flex justify-end gap-2">
      <Button variant="outline" onClick={onCancel}>
        Cancel
      </Button>
      <Button
        onClick={onUseSelection}
        disabled={isDisabled}
        aria-disabled={isDisabled}
      >
        {buttonLabel}
      </Button>
    </div>
  );
}
