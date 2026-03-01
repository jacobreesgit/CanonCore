/**
 * Dialog for creating a new playlist.
 * Form with name, description, visibility radio group, and optional item
 * selection via ItemTreePicker. Follows existing dialog patterns.
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
import { Dialog } from "@/components/ui/dialog";
import { AnimatedDialogContent } from "@/components/ui/animated-dialog-content";
import {
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
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
import { createPlaylist } from "@/lib/playlist-actions";
import { getAllItems } from "@/lib/item-actions";
import { toast } from "sonner";

interface CreatePlaylistDialogProps {
  /** Whether the dialog is open. */
  open: boolean;
  /** Callback when dialog open state changes. */
  onOpenChange: (open: boolean) => void;
  /** Callback after successful playlist creation. */
  onCreated?: (playlist: { id: string; name: string }) => void;
}

/**
 * Modal dialog for creating a new playlist.
 * Validates name client-side, calls server action, shows loading/error states.
 *
 * @param open - Whether the dialog is open
 * @param onOpenChange - Callback when dialog open state changes
 * @param onCreated - Callback after successful playlist creation
 */
export function CreatePlaylistDialog({
  open,
  onOpenChange,
  onCreated,
}: CreatePlaylistDialogProps) {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [visibility, setVisibility] = useState<
    "private" | "unlisted" | "public"
  >("private");
  const [selectedItemIds, setSelectedItemIds] = useState<Set<string>>(
    new Set()
  );
  const [pickerItems, setPickerItems] = useState<PickerItem[]>([]);
  const [loadingItems, setLoadingItems] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const resetForm = useCallback(() => {
    setName("");
    setDescription("");
    setVisibility("private");
    setSelectedItemIds(new Set());
    setPickerItems([]);
    setError(null);
    setIsSubmitting(false);
  }, []);

  const handleItemToggle = useCallback((id: string) => {
    setSelectedItemIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }, []);

  // Set loading synchronously during render (avoids set-state-in-effect lint rule)
  const [prevOpen, setPrevOpen] = useState(false);
  if (open && !prevOpen) {
    setLoadingItems(true);
  }
  if (open !== prevOpen) {
    setPrevOpen(open);
  }

  // Fetch user items when dialog opens
  useEffect(() => {
    if (!open) return;
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
  }, [open]);

  const handleOpenChange = useCallback(
    (nextOpen: boolean) => {
      if (!nextOpen) {
        resetForm();
      }
      onOpenChange(nextOpen);
    },
    [onOpenChange, resetForm]
  );

  const handleSubmit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();

      const trimmed = name.trim();
      if (!trimmed) {
        setError("Name is required");
        return;
      }

      setError(null);
      setIsSubmitting(true);

      try {
        const result = await createPlaylist(trimmed, {
          description: description.trim() || undefined,
          visibility,
          itemIds:
            selectedItemIds.size > 0 ? Array.from(selectedItemIds) : undefined,
        });

        if (result.error) {
          setError(result.error);
          setIsSubmitting(false);
          return;
        }

        if (result.success && result.data) {
          toast.success("Playlist created");
          onCreated?.(result.data);
          handleOpenChange(false);
        }
      } catch {
        setError("Something went wrong");
        setIsSubmitting(false);
      }
    },
    [
      name,
      description,
      visibility,
      selectedItemIds,
      onCreated,
      handleOpenChange,
    ]
  );

  const header = (
    <DialogHeader>
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
          <DialogTitle className="text-lg">Create Playlist</DialogTitle>
          <DialogDescription className="text-sm">
            Give your playlist a name to get started.
          </DialogDescription>
        </div>
      </div>
    </DialogHeader>
  );

  const footer = (
    <DialogFooter>
      <Button
        variant="outline"
        onClick={() => handleOpenChange(false)}
        disabled={isSubmitting}
        data-testid="create-playlist-cancel"
      >
        Cancel
      </Button>
      <Button
        type="submit"
        form="create-playlist-form"
        disabled={isSubmitting || !name.trim()}
        data-testid="create-playlist-submit"
      >
        {isSubmitting ? (
          <>
            <FontAwesomeIcon
              icon={faSpinner}
              spin
              aria-hidden="true"
              className="mr-2 size-4"
            />
            Creating…
          </>
        ) : (
          "Create"
        )}
      </Button>
    </DialogFooter>
  );

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <AnimatedDialogContent
        data-testid="dialog-create-playlist"
        stepKey="create"
        className="sm:max-w-md"
        header={header}
        footer={footer}
      >
        <form
          id="create-playlist-form"
          onSubmit={handleSubmit}
          className="space-y-4 py-2"
        >
          <div className="space-y-2">
            <Label htmlFor="playlist-name">Name</Label>
            <Input
              id="playlist-name"
              data-testid="create-playlist-name-input"
              value={name}
              onChange={(e) => {
                setName(e.target.value);
                if (error) setError(null);
              }}
              placeholder="My Playlist"
              maxLength={255}
              autoComplete="off"
              disabled={isSubmitting}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="playlist-description">Description</Label>
            <Textarea
              id="playlist-description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Add a description (optional)"
              maxLength={1000}
              rows={3}
              disabled={isSubmitting}
            />
          </div>

          {/* Visibility */}
          <fieldset className="space-y-2" disabled={isSubmitting}>
            <Label asChild>
              <legend>Visibility</legend>
            </Label>
            <RadioGroup
              value={visibility}
              onValueChange={(v) =>
                setVisibility(v as "private" | "unlisted" | "public")
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
                    visibility === opt.value
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
                    <p className="text-muted-foreground text-xs">{opt.note}</p>
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
                selectedIds={selectedItemIds}
                onToggle={handleItemToggle}
                multiSelect
                disabled={isSubmitting}
              />
            ) : (
              <p className="text-muted-foreground py-4 text-center text-sm">
                No items in your library yet.
              </p>
            )}
          </div>

          {error && (
            <p
              className="text-destructive text-sm"
              data-testid="create-playlist-error"
              role="alert"
            >
              {error}
            </p>
          )}
        </form>
      </AnimatedDialogContent>
    </Dialog>
  );
}
