/**
 * Dialog for editing playlist name, description, and visibility.
 * Follows the same patterns as CreatePlaylistDialog.
 */

"use client";

import { useState, useCallback } from "react";
import { Loader2, ListMusic } from "lucide-react";
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
import { updatePlaylist } from "@/lib/playlist-actions";
import { toast } from "sonner";

interface EditPlaylistDialogProps {
  /** Whether the dialog is open. */
  open: boolean;
  /** Callback when dialog open state changes. */
  onOpenChange: (open: boolean) => void;
  /** Current playlist data to populate the form. */
  playlist: {
    id: string;
    name: string;
    description: string | null;
    isPublic?: boolean;
  };
  /** Callback after successful playlist update. */
  onUpdated?: (data: {
    name: string;
    description: string | null;
    isPublic?: boolean;
  }) => void;
}

/**
 * Modal dialog for editing an existing playlist.
 * Allows updating name, description, and visibility.
 *
 * @param open - Whether the dialog is open
 * @param onOpenChange - Callback when dialog open state changes
 * @param playlist - Current playlist data
 * @param onUpdated - Callback after successful update
 */
export function EditPlaylistDialog({
  open,
  onOpenChange,
  playlist,
  onUpdated,
}: EditPlaylistDialogProps) {
  const [name, setName] = useState(playlist.name);
  const [description, setDescription] = useState(playlist.description ?? "");
  const [isPublic, setIsPublic] = useState(playlist.isPublic ?? true);
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleOpenChange = useCallback(
    (nextOpen: boolean) => {
      if (nextOpen) {
        // Sync form state from props when dialog opens
        setName(playlist.name);
        setDescription(playlist.description ?? "");
        setIsPublic(playlist.isPublic ?? true);
      } else {
        setError(null);
        setIsSubmitting(false);
      }
      onOpenChange(nextOpen);
    },
    [onOpenChange, playlist.name, playlist.description, playlist.isPublic]
  );

  const handleSubmit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();

      const trimmedName = name.trim();
      if (!trimmedName) {
        setError("Name is required");
        return;
      }

      setError(null);
      setIsSubmitting(true);

      try {
        const trimmedDesc = description.trim() || undefined;
        const result = await updatePlaylist(playlist.id, {
          name: trimmedName,
          description: trimmedDesc,
          isPublic,
        });

        if (result.error) {
          setError(result.error);
          setIsSubmitting(false);
          return;
        }

        toast.success("Playlist updated");
        onUpdated?.({
          name: trimmedName,
          description: trimmedDesc ?? null,
          isPublic,
        });
        handleOpenChange(false);
      } catch {
        setError("Something went wrong");
        setIsSubmitting(false);
      }
    },
    [name, description, isPublic, playlist.id, onUpdated, handleOpenChange]
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
          <ListMusic aria-hidden="true" className="text-primary size-5" />
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
        disabled={isSubmitting}
      >
        Cancel
      </Button>
      <Button
        type="submit"
        form="edit-playlist-form"
        disabled={isSubmitting || !name.trim()}
        data-testid="edit-playlist-submit"
      >
        {isSubmitting ? (
          <>
            <Loader2 className="mr-2 size-4 animate-spin" aria-hidden="true" />
            Saving...
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
        className="sm:max-w-md"
        header={header}
        footer={footer}
      >
        <form
          id="edit-playlist-form"
          onSubmit={handleSubmit}
          className="space-y-4 py-2"
        >
          <div className="space-y-2">
            <Label htmlFor="edit-playlist-name">Name</Label>
            <Input
              id="edit-playlist-name"
              data-testid="edit-playlist-name-input"
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
            <Label htmlFor="edit-playlist-description">Description</Label>
            <Textarea
              id="edit-playlist-description"
              data-testid="edit-playlist-description-input"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Add a description..."
              maxLength={1000}
              rows={3}
              disabled={isSubmitting}
            />
          </div>

          <div className="flex items-center justify-between gap-3">
            <div className="space-y-0.5">
              <Label htmlFor="edit-playlist-public">Public</Label>
              <p className="text-muted-foreground text-xs">
                Visible on your public profile
              </p>
            </div>
            <Switch
              id="edit-playlist-public"
              checked={isPublic}
              onCheckedChange={setIsPublic}
              disabled={isSubmitting}
            />
          </div>

          {error && (
            <p
              className="text-destructive text-sm"
              data-testid="edit-playlist-error"
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
