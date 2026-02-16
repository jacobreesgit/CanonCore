"use client";

/**
 * Visibility toggle component for items.
 * Shows public/private status with inheritance option for child items.
 * Includes warnings about cascading behavior when making items private.
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
import { Globe, Lock, Loader2, AlertTriangle, Link2 } from "lucide-react";
import {
  setItemVisibility,
  setInheritVisibility,
  countInheritingChildren,
} from "@/lib/item-actions";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { ParentPrivacyWarningDialog } from "./parent-privacy-warning-dialog";

interface VisibilityToggleProps {
  /** Item ID */
  itemId: string;
  /** Item name for display in warnings */
  itemName: string;
  /** Current visibility state */
  isPublic: boolean;
  /** Whether item inherits visibility from parent */
  inheritVisibility: boolean;
  /** Whether item has a parent (can inherit) */
  hasParent: boolean;
  /** Whether item has children that will be affected */
  hasChildren?: boolean;
  /** Callback after visibility changes */
  onVisibilityChange?: (isPublic: boolean) => void;
  /** Callback after inherit changes */
  onInheritChange?: (inherit: boolean) => void;
  /** Additional class name */
  className?: string;
}

/**
 * Toggle switch for item visibility with inheritance support.
 * Shows warnings when making items private (cascades to children).
 * Non-root items can toggle inheritance from parent.
 */
export function VisibilityToggle({
  itemId,
  itemName,
  isPublic,
  inheritVisibility,
  hasParent,
  hasChildren = false,
  onVisibilityChange,
  onInheritChange,
  className,
}: VisibilityToggleProps) {
  const [currentPublic, setCurrentPublic] = useState(isPublic);
  const [currentInherit, setCurrentInherit] = useState(inheritVisibility);
  const [isUpdating, setIsUpdating] = useState(false);
  const [showPrivateWarning, setShowPrivateWarning] = useState(false);
  const [showInheritWarning, setShowInheritWarning] = useState(false);
  const [inheritingChildCount, setInheritingChildCount] = useState(0);
  const [pendingValue, setPendingValue] = useState<boolean | null>(null);

  // Generate unique IDs for accessibility
  const inheritHelpId = `inherit-help-${itemId}`;
  const visibilityHelpId = `visibility-help-${itemId}`;

  const handleInheritToggle = async (checked: boolean) => {
    setIsUpdating(true);
    try {
      const result = await setInheritVisibility(itemId, checked);
      if (result.success) {
        setCurrentInherit(checked);
        onInheritChange?.(checked);
        toast.success(
          checked
            ? "Inheriting visibility from parent"
            : "Using explicit visibility"
        );
      } else {
        toast.error(result.error || "Failed to update");
      }
    } catch (error) {
      console.error("Inherit visibility update failed:", error);
      toast.error("Failed to update inheritance setting");
    } finally {
      setIsUpdating(false);
    }
  };

  const handleVisibilityToggle = async (checked: boolean) => {
    // Making public is straightforward
    if (checked) {
      setPendingValue(true);
      performVisibilityUpdate(true);
      return;
    }

    // Making private needs confirmation if has children
    if (hasChildren) {
      // Check specifically for inheriting children
      const count = await countInheritingChildren(itemId);

      if (count > 0) {
        // Show warning about inheriting children
        setInheritingChildCount(count);
        setPendingValue(false);
        setShowInheritWarning(true);
        return;
      }

      // Has children but none inherit - show general warning
      setPendingValue(false);
      setShowPrivateWarning(true);
      return;
    }

    // No children, just update
    performVisibilityUpdate(false);
  };

  const performVisibilityUpdate = async (newValue: boolean) => {
    setIsUpdating(true);
    try {
      const result = await setItemVisibility(itemId, newValue);

      if (result.success) {
        setCurrentPublic(newValue);
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
    } catch (error) {
      console.error("Visibility update failed:", error);
      toast.error("Failed to update visibility");
    } finally {
      setIsUpdating(false);
      setPendingValue(null);
    }
  };

  const confirmMakePrivate = () => {
    setShowPrivateWarning(false);
    if (pendingValue !== null) {
      performVisibilityUpdate(pendingValue);
    }
  };

  const cancelMakePrivate = () => {
    setShowPrivateWarning(false);
    setPendingValue(null);
  };

  const confirmInheritWarning = () => {
    setShowInheritWarning(false);
    if (pendingValue !== null) {
      performVisibilityUpdate(pendingValue);
    }
  };

  const cancelInheritWarning = () => {
    setShowInheritWarning(false);
    setPendingValue(null);
  };

  return (
    <>
      <div className={cn("space-y-4", className)}>
        {/* Inherit toggle - only show for non-root items */}
        {hasParent && (
          <div className="flex items-center justify-between rounded-lg border p-4">
            <div className="flex items-center gap-3">
              <Link2
                aria-hidden="true"
                className="text-muted-foreground size-5"
              />
              <div className="space-y-0.5">
                <Label
                  htmlFor={`inherit-${itemId}`}
                  className="text-sm font-medium"
                >
                  Inherit from parent
                </Label>
                <p id={inheritHelpId} className="text-muted-foreground text-xs">
                  Use the same visibility as the parent item
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              {isUpdating && (
                <Loader2
                  aria-hidden="true"
                  className="text-muted-foreground size-4 animate-spin"
                />
              )}
              <Switch
                id={`inherit-${itemId}`}
                checked={currentInherit}
                onCheckedChange={handleInheritToggle}
                disabled={isUpdating}
                aria-describedby={inheritHelpId}
              />
            </div>
          </div>
        )}

        {/* Public toggle - disabled when inheriting */}
        <div
          className={cn(
            "flex items-center justify-between rounded-lg border p-4",
            currentInherit && "pointer-events-none"
          )}
        >
          <div className="flex items-center gap-3">
            {currentPublic && !currentInherit ? (
              <Globe aria-hidden="true" className="size-5 text-green-500" />
            ) : (
              <Lock
                aria-hidden="true"
                className="text-muted-foreground size-5"
              />
            )}
            <div className="space-y-0.5">
              <Label
                htmlFor={`visibility-${itemId}`}
                className="text-sm font-medium"
              >
                {currentInherit
                  ? "Inherited"
                  : currentPublic
                    ? "Public"
                    : "Private"}
              </Label>
              <p
                id={visibilityHelpId}
                className="text-muted-foreground text-xs"
              >
                {currentInherit
                  ? "Visibility is controlled by parent item"
                  : currentPublic
                    ? "Anyone with the link can view this item"
                    : "Only you can see this item"}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {isUpdating && !currentInherit && (
              <Loader2
                aria-hidden="true"
                className="text-muted-foreground size-4 animate-spin"
              />
            )}
            <Switch
              id={`visibility-${itemId}`}
              checked={currentPublic}
              onCheckedChange={handleVisibilityToggle}
              disabled={isUpdating || currentInherit}
              aria-describedby={visibilityHelpId}
            />
          </div>
        </div>

        {currentInherit && (
          <p className="text-muted-foreground text-xs italic">
            Visibility is inherited from parent. Disable inheritance to set
            explicitly.
          </p>
        )}
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
                className="size-5 text-amber-500"
              />
              Make &quot;{itemName}&quot; Private?
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

      {/* Warning dialog for inheriting children */}
      <ParentPrivacyWarningDialog
        open={showInheritWarning}
        onOpenChange={(open) => {
          if (!open) cancelInheritWarning();
        }}
        itemName={itemName}
        affectedChildCount={inheritingChildCount}
        onConfirm={confirmInheritWarning}
      />
    </>
  );
}
