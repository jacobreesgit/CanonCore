/**
 * Dialog for creating a new playlist.
 * Simple form with name input, loading state, and inline validation error.
 * Follows existing dialog patterns (AddItemDialog, ItemSettingsDialog).
 */

"use client";

import { useState, useCallback } from "react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faSpinner, faMusic } from "@fortawesome/free-solid-svg-icons";
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
import { cn } from "@/lib/utils";
import { createPlaylist } from "@/lib/playlist-actions";
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
  const [isPublic, setIsPublic] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const resetForm = useCallback(() => {
    setName("");
    setDescription("");
    setIsPublic(false);
    setError(null);
    setIsSubmitting(false);
  }, []);

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
          isPublic,
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
    [name, description, isPublic, onCreated, handleOpenChange]
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

          <div className="flex items-center justify-between gap-3">
            <div className="space-y-0.5">
              <Label htmlFor="create-playlist-public">Public</Label>
              <p className="text-muted-foreground text-xs">
                Visible on your public profile
              </p>
            </div>
            <Switch
              id="create-playlist-public"
              checked={isPublic}
              onCheckedChange={setIsPublic}
              disabled={isSubmitting}
            />
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
