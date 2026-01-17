/**
 * Toggle button for switching between view and edit modes.
 * In edit mode, items can be reordered via drag-and-drop.
 * Shows tooltip explaining why button is disabled when applicable.
 */

"use client";

import React from "react";
import { Pencil, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";

interface EditModeToggleProps {
  /** Whether edit mode is currently active. */
  isEditing: boolean;
  /** Callback to toggle edit mode. */
  onToggle(): void;
  /** If true, the toggle is disabled (e.g., when no items). */
  disabled?: boolean;
  /** Reason why the toggle is disabled (shown in tooltip). */
  disabledReason?: string;
}

/**
 * Button to toggle between view and edit modes.
 * Shows "Edit" in view mode, "Done" in edit mode.
 * Displays tooltip with reason when disabled.
 *
 * @param isEditing - Whether edit mode is active
 * @param onToggle - Callback to toggle edit mode
 * @param disabled - Whether the toggle is disabled
 * @param disabledReason - Tooltip text explaining why disabled
 */
export function EditModeToggle({
  isEditing,
  onToggle,
  disabled = false,
  disabledReason,
}: EditModeToggleProps) {
  const button = (
    <Button
      variant="outline"
      size="sm"
      onClick={onToggle}
      disabled={disabled}
      aria-label={isEditing ? "Exit edit mode" : "Enter edit mode"}
      className="gap-1.5"
    >
      {isEditing ? (
        <>
          <Check className="size-4" />
          <span className="hidden sm:inline">Done</span>
        </>
      ) : (
        <>
          <Pencil className="size-4" />
          <span className="hidden sm:inline">Edit</span>
        </>
      )}
    </Button>
  );

  // Wrap in tooltip when disabled with a reason
  if (disabled && disabledReason) {
    return (
      <Tooltip>
        <TooltipTrigger asChild>
          {/* Wrap in span to enable tooltip on disabled button */}
          <span tabIndex={0} className="inline-flex">
            {button}
          </span>
        </TooltipTrigger>
        <TooltipContent side="bottom">{disabledReason}</TooltipContent>
      </Tooltip>
    );
  }

  return button;
}
