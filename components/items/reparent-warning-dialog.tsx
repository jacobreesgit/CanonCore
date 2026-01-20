"use client";

/**
 * Warning dialog shown when moving an inheriting item to a new parent.
 * Alerts user that visibility will change based on new parent's visibility.
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
import { AlertTriangle } from "lucide-react";

interface ReparentWarningDialogProps {
  /** Whether the dialog is open */
  open: boolean;
  /** Callback when open state changes */
  onOpenChange: (open: boolean) => void;
  /** Name of the item being moved */
  itemName: string;
  /** Name of the original parent (null if root) */
  oldParentName: string | null;
  /** Name of the new parent (null if moving to root) */
  newParentName: string | null;
  /** Whether the item will become public after move */
  willBecomePublic: boolean;
  /** Whether the item will become private after move */
  willBecomePrivate: boolean;
  /** Callback when user confirms the move */
  onConfirm: () => void;
}

/**
 * Warning dialog shown when moving an inheriting item to a new parent.
 * Alerts user that visibility will change based on new parent's visibility.
 */
export function ReparentWarningDialog({
  open,
  onOpenChange,
  itemName,
  oldParentName,
  newParentName,
  willBecomePublic,
  willBecomePrivate,
  onConfirm,
}: ReparentWarningDialogProps) {
  const getVisibilityMessage = () => {
    const fromText = oldParentName ? `from "${oldParentName}"` : "from root";
    const toText = newParentName ? `to "${newParentName}"` : "to root";

    if (willBecomePublic) {
      return `Moving "${itemName}" ${fromText} ${toText} will make it publicly visible.`;
    }
    if (willBecomePrivate) {
      return `Moving "${itemName}" ${fromText} ${toText} will make it private.`;
    }
    return `Moving "${itemName}" ${fromText} ${toText} may affect its visibility.`;
  };

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle className="flex items-center gap-2">
            <AlertTriangle
              aria-hidden="true"
              className="h-5 w-5 text-amber-500"
            />
            Visibility will change
          </AlertDialogTitle>
          <AlertDialogDescription>
            {getVisibilityMessage()}
            <br />
            <br />
            This item inherits visibility from its parent. Moving it will change
            who can see it.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <AlertDialogAction onClick={onConfirm}>Move anyway</AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
