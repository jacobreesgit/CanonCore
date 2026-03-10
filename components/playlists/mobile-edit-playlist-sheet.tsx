/**
 * Mobile bottom sheet for editing an existing playlist.
 * Consumes useEditPlaylistForm hook shared with the desktop dialog.
 * Follows existing mobile sheet patterns (MobileCreatePlaylistSheet, etc.).
 */

"use client";

import { useState, useCallback, useEffect } from "react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faSpinner,
  faMusic,
  faUpload,
  faXmark,
  faCopy,
  faRotate,
  faLink,
  faLock,
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
import { FileUpload, FileUploadTrigger } from "@/components/diceui/file-upload";
import { cn } from "@/lib/utils";
import {
  useEditPlaylistForm,
  type EditPlaylistData,
  type EditPlaylistResult,
} from "@/hooks/use-edit-playlist-form";

export interface MobileEditPlaylistSheetProps {
  /** Whether the sheet is open. */
  open: boolean;
  /** Callback when open state changes. */
  onOpenChange: (open: boolean) => void;
  /** Current playlist data to populate the form. */
  playlist: EditPlaylistData;
  /** Profile username for share link construction. */
  username?: string;
  /** Callback after successful playlist update. */
  onUpdated?: (data: EditPlaylistResult) => void;
}

/**
 * Mobile bottom sheet for editing an existing playlist.
 * Mirrors EditPlaylistDialog form fields in a swipe-dismissible sheet.
 */
export function MobileEditPlaylistSheet({
  open,
  onOpenChange,
  playlist,
  username,
  onUpdated,
}: MobileEditPlaylistSheetProps) {
  const [showDiscardAlert, setShowDiscardAlert] = useState(false);

  const handleClose = useCallback(() => {
    onOpenChange(false);
  }, [onOpenChange]);

  const form = useEditPlaylistForm(playlist, username, onUpdated, handleClose);

  // Reset form when sheet opens
  useEffect(() => {
    if (open) {
      form.reset();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- only reset on open change
  }, [open]);

  // Track whether user has made changes (for discard alert)
  const initialVisibility = playlist.isPublic
    ? "public"
    : playlist.shareToken
      ? "unlisted"
      : "private";
  const hasChanges =
    form.name !== playlist.name ||
    form.description !== (playlist.description ?? "") ||
    form.visibility !== initialVisibility ||
    form.artworkFile !== null ||
    form.removeArt;

  const handleOpenChange = useCallback(
    (newOpen: boolean) => {
      if (!newOpen && hasChanges) {
        setShowDiscardAlert(true);
        return;
      }
      onOpenChange(newOpen);
    },
    [hasChanges, onOpenChange]
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
        title="Edit Playlist"
        description="Update your playlist details"
        className={cn(
          "glass-dialog",
          "border-t border-white/[0.08]",
          "text-foreground"
        )}
        data-testid="sheet-edit-playlist"
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
              <MobileBottomSheetTitle>Edit Playlist</MobileBottomSheetTitle>
              <p className="text-muted-foreground text-sm">
                Update your playlist details.
              </p>
            </div>
          </div>
        </MobileBottomSheetHeader>

        <MobileBottomSheetContent>
          <form
            id="mobile-edit-playlist-form"
            onSubmit={form.handleSubmit}
            className="space-y-4"
          >
            {/* Artwork section */}
            <div className="space-y-2">
              <Label>Artwork</Label>
              <FileUpload
                value={form.artworkFile ? [form.artworkFile] : []}
                onValueChange={(files) => {
                  if (files.length > 0) form.handleArtworkDrop(files);
                }}
                accept="image/jpeg,image/png,image/webp"
                maxFiles={1}
                maxSize={2 * 1024 * 1024}
              >
                <div
                  className={cn(
                    "relative aspect-square w-32 overflow-hidden rounded-lg",
                    "bg-muted ring-border/20 ring-1"
                  )}
                >
                  {form.artworkSrc ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={form.artworkSrc}
                      alt=""
                      width={128}
                      height={128}
                      className="size-full object-cover"
                    />
                  ) : (
                    <div className="flex size-full items-center justify-center">
                      <FontAwesomeIcon
                        icon={faMusic}
                        className="text-muted-foreground/40 size-8"
                      />
                    </div>
                  )}
                  <div className="absolute right-1 bottom-1 flex gap-1">
                    <FileUploadTrigger asChild>
                      <Button
                        type="button"
                        size="icon"
                        variant="secondary"
                        className="size-7 shadow-md"
                        aria-label="Upload artwork"
                      >
                        <FontAwesomeIcon icon={faUpload} className="size-3.5" />
                      </Button>
                    </FileUploadTrigger>
                    {(form.artworkSrc || form.artworkFile) && (
                      <Button
                        type="button"
                        size="icon"
                        variant="secondary"
                        className="size-7 shadow-md"
                        aria-label="Remove artwork"
                        onClick={form.handleRemoveArtwork}
                      >
                        <FontAwesomeIcon icon={faXmark} className="size-3.5" />
                      </Button>
                    )}
                  </div>
                </div>
              </FileUpload>
            </div>

            {/* Name */}
            <div className="space-y-2">
              <Label htmlFor="mobile-edit-playlist-name">Name</Label>
              <Input
                id="mobile-edit-playlist-name"
                value={form.name}
                onChange={(e) => {
                  form.setName(e.target.value);
                  if (form.error) form.setError(null);
                }}
                placeholder="My Playlist"
                maxLength={255}
                autoComplete="off"
                disabled={form.isSubmitting}
              />
            </div>

            {/* Description */}
            <div className="space-y-2">
              <Label htmlFor="mobile-edit-playlist-description">
                Description{" "}
                <span className="text-muted-foreground font-normal">
                  (optional)
                </span>
              </Label>
              <Textarea
                id="mobile-edit-playlist-description"
                value={form.description}
                onChange={(e) => form.setDescription(e.target.value)}
                placeholder="Add a description (optional)"
                maxLength={1000}
                rows={3}
                disabled={form.isSubmitting}
                className="resize-none"
              />
              <p className="text-muted-foreground text-xs tabular-nums">
                {form.description.length}/1000 characters
              </p>
            </div>

            {/* Visibility */}
            <fieldset className="space-y-2" disabled={form.isSubmitting}>
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

            {/* Shareable link (shown for unlisted playlists with an active token) */}
            {form.visibility === "unlisted" &&
              form.shareToken &&
              form.shareToken !== "pending" &&
              username && (
                <div className="flex items-center gap-2">
                  <div className="relative flex-1">
                    <FontAwesomeIcon
                      icon={faLink}
                      className="text-muted-foreground absolute top-1/2 left-2.5 size-3.5 -translate-y-1/2"
                    />
                    <Input
                      readOnly
                      aria-label="Shareable link"
                      value={`${typeof window !== "undefined" ? window.location.origin : ""}/u/${username}/playlists/${playlist.id}?token=${form.shareToken}`}
                      className="h-8 truncate pl-8 text-xs"
                    />
                  </div>
                  <Button
                    type="button"
                    size="icon"
                    variant="outline"
                    className="size-8 shrink-0"
                    onClick={form.handleCopyShareLink}
                    aria-label="Copy link"
                  >
                    <FontAwesomeIcon icon={faCopy} className="size-3.5" />
                  </Button>
                  <Button
                    type="button"
                    size="icon"
                    variant="outline"
                    className="size-8 shrink-0"
                    onClick={form.handleRegenerate}
                    disabled={form.isRegenerating}
                    aria-label="Regenerate link"
                  >
                    <FontAwesomeIcon
                      icon={faRotate}
                      spin={form.isRegenerating}
                      className="size-3.5"
                    />
                  </Button>
                </div>
              )}

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
              disabled={form.isSubmitting}
              className="flex-1"
            >
              Cancel
            </Button>
            <Button
              type="submit"
              form="mobile-edit-playlist-form"
              disabled={form.isSubmitting || !form.name.trim()}
              className="flex-1"
            >
              {form.isSubmitting ? (
                <>
                  <FontAwesomeIcon
                    icon={faSpinner}
                    spin
                    aria-hidden="true"
                    className="size-4"
                  />
                  Saving…
                </>
              ) : (
                "Save"
              )}
            </Button>
          </div>
        </MobileBottomSheetFooter>
      </MobileBottomSheet>

      <DiscardChangesAlert
        open={showDiscardAlert}
        onOpenChange={setShowDiscardAlert}
        onDiscard={handleDiscard}
        title="Discard changes?"
        description="You have unsaved changes. Are you sure you want to discard?"
      />
    </>
  );
}
