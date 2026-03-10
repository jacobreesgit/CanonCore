/**
 * Dialog for editing playlist name, description, visibility, artwork, and sharing.
 * Consumes useEditPlaylistForm hook shared with the mobile sheet.
 */

"use client";

import { useCallback } from "react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faSpinner,
  faMusic,
  faUpload,
  faXmark,
  faCopy,
  faRotate,
  faLink,
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
import { Switch } from "@/components/ui/switch";
import { FileUpload, FileUploadTrigger } from "@/components/diceui/file-upload";
import { cn } from "@/lib/utils";
import {
  useEditPlaylistForm,
  type EditPlaylistData,
  type EditPlaylistResult,
} from "@/hooks/use-edit-playlist-form";

interface EditPlaylistDialogProps {
  /** Whether the dialog is open. */
  open: boolean;
  /** Callback when dialog open state changes. */
  onOpenChange: (open: boolean) => void;
  /** Current playlist data to populate the form. */
  playlist: EditPlaylistData;
  /** Profile username for share link construction. */
  username?: string;
  /** Callback after successful playlist update. */
  onUpdated?: (data: EditPlaylistResult) => void;
}

/**
 * Modal dialog for editing an existing playlist.
 * Allows updating name, description, visibility, artwork, and sharing.
 */
export function EditPlaylistDialog({
  open,
  onOpenChange,
  playlist,
  username,
  onUpdated,
}: EditPlaylistDialogProps) {
  const handleClose = useCallback(() => {
    onOpenChange(false);
  }, [onOpenChange]);

  const form = useEditPlaylistForm(playlist, username, onUpdated, handleClose);

  const handleOpenChange = useCallback(
    (nextOpen: boolean) => {
      if (nextOpen) {
        form.reset();
      } else {
        form.setError(null);
      }
      onOpenChange(nextOpen);
    },
    [onOpenChange, form]
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
          <DialogTitle className="text-lg">Edit Playlist</DialogTitle>
          <DialogDescription className="text-sm">
            Update your playlist details.
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
        disabled={form.isSubmitting}
      >
        Cancel
      </Button>
      <Button
        type="submit"
        form="edit-playlist-form"
        disabled={form.isSubmitting || !form.name.trim()}
        data-testid="edit-playlist-submit"
      >
        {form.isSubmitting ? (
          <>
            <FontAwesomeIcon
              icon={faSpinner}
              spin
              aria-hidden="true"
              className="mr-2 size-4"
            />
            Saving…
          </>
        ) : (
          "Save"
        )}
      </Button>
    </DialogFooter>
  );

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <AnimatedDialogContent
        data-testid="dialog-edit-playlist"
        stepKey="edit"
        className="glass-dialog border border-[var(--glass-border)] shadow-[0_8px_32px_rgba(0,0,0,0.4)] sm:max-w-md"
        header={header}
        footer={footer}
      >
        <form
          id="edit-playlist-form"
          onSubmit={form.handleSubmit}
          className="space-y-4 py-2"
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
            <Label htmlFor="edit-playlist-name">Name</Label>
            <Input
              id="edit-playlist-name"
              data-testid="edit-playlist-name-input"
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
            <Label htmlFor="edit-playlist-description">
              Description{" "}
              <span className="text-muted-foreground font-normal">
                (optional)
              </span>
            </Label>
            <Textarea
              id="edit-playlist-description"
              data-testid="edit-playlist-description-input"
              value={form.description}
              onChange={(e) => form.setDescription(e.target.value)}
              placeholder="Add a description&#x2026;"
              maxLength={1000}
              rows={3}
              disabled={form.isSubmitting}
            />
            <p className="text-muted-foreground text-xs tabular-nums">
              {form.description.length}/1000 characters
            </p>
          </div>

          {/* Visibility toggle */}
          <div className="flex items-center justify-between gap-3">
            <div className="space-y-0.5">
              <Label htmlFor="edit-playlist-public">Public</Label>
              <p className="text-muted-foreground text-xs">
                Visible on your public profile
              </p>
            </div>
            <Switch
              id="edit-playlist-public"
              checked={form.isPublic}
              onCheckedChange={form.setIsPublic}
              disabled={form.isSubmitting}
            />
          </div>

          {/* Shareable link section (only for non-public playlists) */}
          {!form.isPublic && (
            <div className="space-y-3">
              <div className="flex items-center justify-between gap-3">
                <div className="space-y-0.5">
                  <Label htmlFor="edit-playlist-share">Shareable link</Label>
                  <p className="text-muted-foreground text-xs">
                    Anyone with the link can view
                  </p>
                </div>
                <Switch
                  id="edit-playlist-share"
                  checked={!!form.shareToken}
                  onCheckedChange={form.handleShareToggle}
                  disabled={form.isSubmitting}
                />
              </div>

              {form.shareToken && form.shareToken !== "pending" && username && (
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
            </div>
          )}

          {form.error && (
            <p
              className="text-destructive text-sm"
              data-testid="edit-playlist-error"
              role="alert"
            >
              {form.error}
            </p>
          )}
        </form>
      </AnimatedDialogContent>
    </Dialog>
  );
}
