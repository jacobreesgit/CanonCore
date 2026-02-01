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
import { AlertTriangle, Loader2 } from "lucide-react";

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
  const childText =
    affectedChildCount === 1
      ? "1 child item"
      : `${affectedChildCount} child items`;

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle className="flex items-center gap-2">
            <AlertTriangle
              aria-hidden="true"
              className="h-5 w-5 text-amber-500"
            />
            This will affect child items
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
                <Loader2
                  aria-hidden="true"
                  className="mr-2 size-4 animate-spin"
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
