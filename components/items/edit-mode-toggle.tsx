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
  /** If true, the toggle is hidden (e.g., when no items). */
  disabled?: boolean;
}

/**
 * Button to toggle between view and edit modes.
 * Shows "Edit" in view mode, "Done" in edit mode.
 *
 * @param props - Toggle properties
 */
export function EditModeToggle({
  isEditing,
  onToggle,
  disabled = false,
}: EditModeToggleProps) {
  if (disabled) {
    return null;
  }

  return (
    <Button
      variant="outline"
      size="sm"
      onClick={onToggle}
      aria-label={isEditing ? "Done editing" : "Edit items"}
      className="gap-1.5"
    >
      {isEditing ? (
        <>
          <Check className="size-4" />
          Done
        </>
      ) : (
        <>
          <Pencil className="size-4" />
          Edit
        </>
      )}
    </Button>
  );
}
