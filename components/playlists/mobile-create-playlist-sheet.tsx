/**
 * Mobile bottom sheet for creating a new playlist.
 * Consumes useCreatePlaylistForm hook shared with the desktop dialog.
 * Follows existing mobile sheet patterns (MobileAddItemSheet, etc.).
 */

"use client";

import { useState, useCallback, useEffect } from "react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faSpinner,
  faMusic,
  faLock,
  faLink,
  faGlobe,
} from "@fortawesome/free-solid-svg-icons";
import {
  MobileBottomSheet,
  MobileBottomSheetHeader,
  MobileBottomSheetTitle,
  MobileBottomSheetContent,
  MobileBottomSheetFooter,
} from "@/components/mobile/mobile-bottom-sheet";
import { DiscardChangesAlert } from "@/components/mobile/discard-changes-alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import {
  ItemTreePicker,
  type PickerItem,
} from "@/components/items/item-tree-picker";
import { cn } from "@/lib/utils";
import { getAllItems } from "@/lib/item-actions";
import { useCreatePlaylistForm } from "@/hooks/use-create-playlist-form";

export interface MobileCreatePlaylistSheetProps {
  /** Whether the sheet is open. */
  open: boolean;
  /** Callback when open state changes. */
  onOpenChange: (open: boolean) => void;
  /** Callback after successful playlist creation. */
  onCreated?: (playlist: { id: string; name: string }) => void;
}

/**
 * Mobile bottom sheet for creating a new playlist.
 * Mirrors CreatePlaylistDialog form fields in a swipe-dismissible sheet.
 */
export function MobileCreatePlaylistSheet({
  open,
  onOpenChange,
  onCreated,
}: MobileCreatePlaylistSheetProps) {
  const [showDiscardAlert, setShowDiscardAlert] = useState(false);
  const [pickerItems, setPickerItems] = useState<PickerItem[]>([]);
  const [loadingItems, setLoadingItems] = useState(false);

  const handleClose = useCallback(() => {
    onOpenChange(false);
  }, [onOpenChange]);

  const form = useCreatePlaylistForm(onCreated, handleClose);

  // Reset form + fetch items when sheet opens
  useEffect(() => {
    if (!open) return;
    form.reset();
    setLoadingItems(true);
    let cancelled = false;

    getAllItems()
      .then((result) => {
        if (cancelled) return;
        if (result.success && result.data) {
          const parentIds = new Set(
            result.data.map((i) => i.parentId).filter(Boolean)
          );
          setPickerItems(
            result.data.map((item) => ({
              id: item.id,
              name: item.name,
              depth: item.depth,
              hasChildren: parentIds.has(item.id),
            }))
          );
        }
        setLoadingItems(false);
      })
      .catch(() => {
        if (cancelled) return;
        setLoadingItems(false);
      });

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- only reset on open change
  }, [open]);

  const handleOpenChange = useCallback(
    (newOpen: boolean) => {
      if (!newOpen && form.name.trim()) {
        setShowDiscardAlert(true);
        return;
      }
      onOpenChange(newOpen);
    },
    [form.name, onOpenChange]
  );

  const handleDiscard = useCallback(() => {
    setShowDiscardAlert(false);
    onOpenChange(false);
  }, [onOpenChange]);

  return (
    <>
      <MobileBottomSheet
        open={open}
        onOpenChange={handleOpenChange}
        snapPoints={[0.85]}
        repositionInputs
        title="Create Playlist"
        description="Give your playlist a name to get started"
        className={cn(
          "glass-dialog",
          "border-t border-white/[0.08]",
          "text-foreground"
        )}
        data-testid="sheet-create-playlist"
      >
        <MobileBottomSheetHeader>
          <div className="flex items-center gap-3">
            <div
              className={cn(
                "flex size-10 shrink-0 items-center justify-center rounded-xl",
                "bg-primary/10 ring-primary/20 ring-1"
              )}
            >
              <FontAwesomeIcon
                icon={faMusic}
                aria-hidden="true"
                className="text-primary size-5"
              />
            </div>
            <div className="min-w-0">
              <MobileBottomSheetTitle>Create Playlist</MobileBottomSheetTitle>
              <p className="text-muted-foreground text-sm">
                Give your playlist a name to get started.
              </p>
            </div>
          </div>
        </MobileBottomSheetHeader>

        <MobileBottomSheetContent>
          <form
            id="mobile-create-playlist-form"
            onSubmit={form.handleSubmit}
            className="space-y-4"
          >
            <div className="space-y-2">
              <Label htmlFor="mobile-playlist-name">Name</Label>
              <Input
                id="mobile-playlist-name"
                data-testid="create-playlist-name-input"
                value={form.name}
                onChange={(e) => {
                  form.setName(e.target.value);
                  if (form.error) form.setError(null);
                }}
                placeholder="My Playlist"
                maxLength={255}
                autoComplete="off"
                disabled={form.isCreating}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="mobile-playlist-description">
                Description{" "}
                <span className="text-muted-foreground font-normal">
                  (optional)
                </span>
              </Label>
              <Textarea
                id="mobile-playlist-description"
                value={form.description}
                onChange={(e) => form.setDescription(e.target.value)}
                placeholder="Add a description (optional)"
                maxLength={1000}
                rows={3}
                disabled={form.isCreating}
                className="resize-none"
              />
              <p className="text-muted-foreground text-xs tabular-nums">
                {form.description.length}/1000 characters
              </p>
            </div>

            {/* Visibility */}
            <fieldset className="space-y-2" disabled={form.isCreating}>
              <Label asChild>
                <legend>Visibility</legend>
              </Label>
              <RadioGroup
                value={form.visibility}
                onValueChange={(v) =>
                  form.setVisibility(v as "private" | "unlisted" | "public")
                }
                className="grid gap-2"
              >
                {(
                  [
                    {
                      value: "private",
                      icon: faLock,
                      label: "Private",
                      note: "Only you can see this playlist",
                    },
                    {
                      value: "unlisted",
                      icon: faLink,
                      label: "Unlisted",
                      note: "Accessible via share link",
                    },
                    {
                      value: "public",
                      icon: faGlobe,
                      label: "Public",
                      note: "Visible on explore page",
                    },
                  ] as const
                ).map((opt) => (
                  <label
                    key={opt.value}
                    className={cn(
                      "flex cursor-pointer items-center gap-3 rounded-lg border px-3 py-2.5 transition-colors",
                      "focus-within:ring-2 focus-within:ring-white/30",
                      form.visibility === opt.value
                        ? "border-white/30 bg-white/20"
                        : "border-white/10 bg-white/5 hover:bg-white/10"
                    )}
                  >
                    <RadioGroupItem value={opt.value} className="sr-only" />
                    <FontAwesomeIcon
                      icon={opt.icon}
                      className="text-muted-foreground size-4"
                    />
                    <div className="min-w-0">
                      <span className="text-sm font-medium">{opt.label}</span>
                      <p className="text-muted-foreground text-xs">
                        {opt.note}
                      </p>
                    </div>
                  </label>
                ))}
              </RadioGroup>
            </fieldset>

            {/* Item selection */}
            <div className="space-y-2">
              <Label>Add Items (optional)</Label>
              {loadingItems ? (
                <div className="flex items-center justify-center py-6">
                  <FontAwesomeIcon
                    icon={faSpinner}
                    spin
                    className="text-muted-foreground size-4"
                  />
                </div>
              ) : pickerItems.length > 0 ? (
                <ItemTreePicker
                  items={pickerItems}
                  selectedIds={form.selectedItemIds}
                  onToggle={form.toggleItemId}
                  multiSelect
                  disabled={form.isCreating}
                />
              ) : (
                <p className="text-muted-foreground py-4 text-center text-sm">
                  No items in your library yet.
                </p>
              )}
            </div>

            {form.error && (
              <p className="text-destructive text-sm" role="alert">
                {form.error}
              </p>
            )}
          </form>
        </MobileBottomSheetContent>

        <MobileBottomSheetFooter className="pb-[calc(1rem+env(safe-area-inset-bottom))]">
          <div className="flex gap-3">
            <Button
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={form.isCreating}
              className="flex-1"
            >
              Cancel
            </Button>
            <Button
              type="submit"
              form="mobile-create-playlist-form"
              disabled={form.isCreating || !form.name.trim()}
              className="flex-1"
              data-testid="create-playlist-submit"
            >
              {form.isCreating ? (
                <>
                  <FontAwesomeIcon
                    icon={faSpinner}
                    spin
                    aria-hidden="true"
                    className="size-4"
                  />
                  Creating…
                </>
              ) : (
                "Create"
              )}
            </Button>
          </div>
        </MobileBottomSheetFooter>
      </MobileBottomSheet>

      <DiscardChangesAlert
        open={showDiscardAlert}
        onOpenChange={setShowDiscardAlert}
        onDiscard={handleDiscard}
        title="Discard playlist?"
        description="You have unsaved changes. Are you sure you want to discard?"
      />
    </>
  );
}
