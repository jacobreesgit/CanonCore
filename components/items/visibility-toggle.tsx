"use client";

/**
 * Visibility toggle component for items.
 * Shows public/private status with warnings about cascading behavior.
 */

import { useState } from "react";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
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
import { Globe, Lock, Loader2, AlertTriangle } from "lucide-react";
import { setItemVisibility } from "@/lib/item-actions";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

interface VisibilityToggleProps {
  /** Item ID */
  itemId: string;
  /** Current visibility state */
  isPublic: boolean;
  /** Whether item has children that will be affected */
  hasChildren?: boolean;
  /** Callback after visibility changes */
  onVisibilityChange?: (isPublic: boolean) => void;
  /** Additional class name */
  className?: string;
}

/**
 * Toggle switch for item visibility with confirmation dialogs.
 * Shows warnings when making items private (cascades to children).
 */
export function VisibilityToggle({
  itemId,
  isPublic,
  hasChildren = false,
  onVisibilityChange,
  className,
}: VisibilityToggleProps) {
  const [currentValue, setCurrentValue] = useState(isPublic);
  const [isUpdating, setIsUpdating] = useState(false);
  const [showPrivateWarning, setShowPrivateWarning] = useState(false);
  const [pendingValue, setPendingValue] = useState<boolean | null>(null);

  const handleToggle = (checked: boolean) => {
    // Making public is straightforward
    if (checked) {
      setPendingValue(true);
      performUpdate(true);
      return;
    }

    // Making private needs confirmation if has children
    if (hasChildren) {
      setPendingValue(false);
      setShowPrivateWarning(true);
      return;
    }

    // No children, just update
    performUpdate(false);
  };

  const performUpdate = async (newValue: boolean) => {
    setIsUpdating(true);
    try {
      const result = await setItemVisibility(itemId, newValue);

      if (result.success) {
        setCurrentValue(newValue);
        onVisibilityChange?.(newValue);
        toast.success(newValue ? "Item is now public" : "Item is now private", {
          description: newValue
            ? "Anyone with the link can view this item."
            : result.data?.affectedCount && result.data.affectedCount > 0
              ? `${result.data.affectedCount} child item(s) also made private.`
              : undefined,
        });
      } else {
        toast.error(result.error || "Failed to update visibility");
      }
    } catch {
      toast.error("Failed to update visibility");
    } finally {
      setIsUpdating(false);
      setPendingValue(null);
    }
  };

  const confirmMakePrivate = () => {
    setShowPrivateWarning(false);
    if (pendingValue !== null) {
      performUpdate(pendingValue);
    }
  };

  const cancelMakePrivate = () => {
    setShowPrivateWarning(false);
    setPendingValue(null);
  };

  return (
    <>
      <div
        className={cn(
          "flex items-center justify-between rounded-lg border p-4",
          className
        )}
      >
        <div className="flex items-center gap-3">
          {currentValue ? (
            <Globe aria-hidden="true" className="h-5 w-5 text-green-500" />
          ) : (
            <Lock
              aria-hidden="true"
              className="text-muted-foreground h-5 w-5"
            />
          )}
          <div className="space-y-0.5">
            <Label
              htmlFor={`visibility-${itemId}`}
              className="text-sm font-medium"
            >
              {currentValue ? "Public" : "Private"}
            </Label>
            <p className="text-muted-foreground text-xs">
              {currentValue
                ? "Anyone with the link can view this item"
                : "Only you can see this item"}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {isUpdating && (
            <Loader2
              aria-hidden="true"
              className="text-muted-foreground h-4 w-4 animate-spin"
            />
          )}
          <Switch
            id={`visibility-${itemId}`}
            checked={currentValue}
            onCheckedChange={handleToggle}
            disabled={isUpdating}
          />
        </div>
      </div>

      {/* Warning dialog for making private */}
      <AlertDialog
        open={showPrivateWarning}
        onOpenChange={setShowPrivateWarning}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <AlertTriangle
                aria-hidden="true"
                className="h-5 w-5 text-amber-500"
              />
              Make Item Private?
            </AlertDialogTitle>
            <AlertDialogDescription>
              This item has child items. Making it private will also make all
              child items private. This action cannot be undone automatically -
              you&apos;ll need to manually make each item public again.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={cancelMakePrivate}>
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction onClick={confirmMakePrivate}>
              Make Private
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
