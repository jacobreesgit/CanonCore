/**
 * Shared discard changes alert dialog for mobile bottom sheets.
 * Extracted to avoid duplicating the same AlertDialog pattern
 * across mobile-item-sheet, mobile-add-item-sheet, and mobile-settings-sheet.
 */

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

interface DiscardChangesAlertProps {
  /** Whether the alert is open. */
  open: boolean;
  /** Callback when open state changes. */
  onOpenChange: (open: boolean) => void;
  /** Callback when discard is confirmed. */
  onDiscard: () => void;
  /** Title text. */
  title?: string;
  /** Description text. */
  description?: string;
}

/**
 * Alert dialog for confirming discard of unsaved changes.
 *
 * @param open - Whether the alert is visible
 * @param onOpenChange - Callback for visibility changes
 * @param onDiscard - Callback when user confirms discard
 * @param title - Custom title (defaults to "Discard unsaved changes?")
 * @param description - Custom description
 */
export function DiscardChangesAlert({
  open,
  onOpenChange,
  onDiscard,
  title = "Discard unsaved changes?",
  description = "You have unsaved changes. Are you sure you want to discard them?",
}: DiscardChangesAlertProps) {
  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{title}</AlertDialogTitle>
          <AlertDialogDescription>{description}</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Keep Editing</AlertDialogCancel>
          <AlertDialogAction onClick={onDiscard}>Discard</AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
