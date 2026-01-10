/**
 * Toggle button for switching between view and edit modes.
 * In edit mode, items can be reordered via drag-and-drop.
 */

"use client";

import React from "react";
import { Pencil, Check } from "lucide-react";
import { Button } from "@/components/ui/button";

interface EditModeToggleProps {
  /** Whether edit mode is currently active. */
  isEditing: boolean;
  /** Callback to toggle edit mode. */
  onToggle(): void;
  /** If true, the toggle is disabled (e.g., when no items). */
  disabled?: boolean;
}

/**
 * Button to toggle between view and edit modes.
 * Shows "Edit Mode" in view mode, "View Mode" in edit mode.
 *
 * @param props - Toggle properties
 */
export function EditModeToggle({
  isEditing,
  onToggle,
  disabled = false,
}: EditModeToggleProps) {
  return (
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
          View Mode
        </>
      ) : (
        <>
          <Pencil className="size-4" />
          Edit Mode
        </>
      )}
    </Button>
  );
}
