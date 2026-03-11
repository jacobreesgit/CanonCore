"use client";

/**
 * Warning dialog shown when making a parent item private.
 * Alerts user that inheriting children will also become effectively private.
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
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faTriangleExclamation,
  faSpinner,
} from "@fortawesome/free-solid-svg-icons";

interface ParentPrivacyWarningDialogProps {
  /** Whether the dialog is open */
  open: boolean;
  /** Callback when open state changes */
  onOpenChange: (open: boolean) => void;
  /** Name of the item being made private */
  itemName: string;
  /** Number of inheriting children that will be affected */
  affectedChildCount: number;
  /** Callback when user confirms making the item private */
  onConfirm: () => void;
  /** Whether a loading operation is in progress */
  isLoading?: boolean;
}

/**
 * Warning dialog shown when making a parent item private.
 * Alerts user that inheriting children will also become effectively private.
 */
export function ParentPrivacyWarningDialog({
  open,
  onOpenChange,
  itemName,
  affectedChildCount,
  onConfirm,
  isLoading = false,
}: ParentPrivacyWarningDialogProps) {
  const isSingular = affectedChildCount === 1;
  const childText = isSingular
    ? "1 child item"
    : `${affectedChildCount} child items`;

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent className="glass-dialog">
        <AlertDialogHeader>
          <AlertDialogTitle className="flex items-center gap-2">
            <FontAwesomeIcon
              icon={faTriangleExclamation}
              aria-hidden="true"
              className="h-5 w-5 text-amber-500"
            />
            {isSingular
              ? "This will affect a child item"
              : "This will affect child items"}
          </AlertDialogTitle>
          <AlertDialogDescription>
            Making &quot;{itemName}&quot; private will also hide {childText}{" "}
            that inherit visibility from it.
            <br />
            <br />
            These items will no longer be accessible to others until you make
            this item public again or change their visibility settings
            individually.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={isLoading}>Cancel</AlertDialogCancel>
          <AlertDialogAction onClick={onConfirm} disabled={isLoading}>
            {isLoading ? (
              <>
                <FontAwesomeIcon
                  icon={faSpinner}
                  aria-hidden="true"
                  className="mr-2 size-4"
                  spin
                />
                Updating…
              </>
            ) : (
              "Make private"
            )}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
