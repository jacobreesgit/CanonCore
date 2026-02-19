/**
 * Dialog for editing playlist name, description, visibility, artwork, and sharing.
 * Follows the same patterns as CreatePlaylistDialog and settings-dialog hero upload.
 */

"use client";

import { useState, useCallback, useEffect } from "react";
import {
  Loader2,
  ListMusic,
  Upload,
  X,
  Copy,
  RefreshCw,
  Link2,
} from "lucide-react";
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
  updatePlaylist,
  updatePlaylistArtwork,
  removePlaylistArtwork,
  regenerateShareToken,
} from "@/lib/playlist-actions";
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
    hasArtwork?: boolean;
    shareToken?: string | null;
  };
  /** Profile username for share link construction. */
  username?: string;
  /** Callback after successful playlist update. */
  onUpdated?: (data: {
    name: string;
    description: string | null;
    isPublic?: boolean;
    hasArtwork?: boolean;
    shareToken?: string | null;
  }) => void;
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
  const [name, setName] = useState(playlist.name);
  const [description, setDescription] = useState(playlist.description ?? "");
  const [isPublic, setIsPublic] = useState(playlist.isPublic ?? true);
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Artwork state
  const [artworkFile, setArtworkFile] = useState<File | null>(null);
  const [artworkPreview, setArtworkPreview] = useState<string | null>(null);
  const [removeArt, setRemoveArt] = useState(false);

  // Share token state
  const [shareToken, setShareToken] = useState(playlist.shareToken ?? null);
  const [isRegenerating, setIsRegenerating] = useState(false);

  // Cleanup preview URLs
  useEffect(() => {
    return () => {
      if (artworkPreview) URL.revokeObjectURL(artworkPreview);
    };
  }, [artworkPreview]);

  const handleOpenChange = useCallback(
    (nextOpen: boolean) => {
      if (nextOpen) {
        // Sync form state from props when dialog opens
        setName(playlist.name);
        setDescription(playlist.description ?? "");
        setIsPublic(playlist.isPublic ?? true);
        setArtworkFile(null);
        setArtworkPreview(null);
        setRemoveArt(false);
        setShareToken(playlist.shareToken ?? null);
      } else {
        setError(null);
        setIsSubmitting(false);
      }
      onOpenChange(nextOpen);
    },
    [
      onOpenChange,
      playlist.name,
      playlist.description,
      playlist.isPublic,
      playlist.shareToken,
    ]
  );

  const handleArtworkDrop = useCallback((files: File[]) => {
    const file = files[0];
    if (file) {
      setArtworkFile(file);
      setRemoveArt(false);
      setArtworkPreview(URL.createObjectURL(file));
    }
  }, []);

  const handleRemoveArtwork = useCallback(() => {
    setArtworkFile(null);
    if (artworkPreview) URL.revokeObjectURL(artworkPreview);
    setArtworkPreview(null);
    setRemoveArt(true);
  }, [artworkPreview]);

  const handleShareToggle = useCallback(
    async (enabled: boolean) => {
      if (enabled) {
        // Single call: generates token and returns it (no partial failure)
        setShareToken("pending");
        const result = await regenerateShareToken(playlist.id);
        if (result.success && result.data) {
          setShareToken(result.data.shareToken);
        } else {
          setShareToken(null);
          toast.error(result.error ?? "Failed to enable sharing");
        }
      } else {
        const result = await updatePlaylist(playlist.id, {
          enableSharing: false,
        });
        if (result.error) {
          toast.error(result.error);
        } else {
          setShareToken(null);
        }
      }
    },
    [playlist.id]
  );

  const handleRegenerate = useCallback(async () => {
    setIsRegenerating(true);
    const result = await regenerateShareToken(playlist.id);
    if (result.error) {
      toast.error(result.error);
    } else if (result.success && result.data) {
      setShareToken(result.data.shareToken);
      toast.success("Link regenerated");
    }
    setIsRegenerating(false);
  }, [playlist.id]);

  const handleCopyShareLink = useCallback(() => {
    if (!shareToken || shareToken === "pending" || !username) return;
    const url = `${window.location.origin}/u/${username}/playlists/${playlist.id}?token=${shareToken}`;
    navigator.clipboard.writeText(url).then(
      () => toast.success("Link copied to clipboard"),
      () => toast.error("Failed to copy link")
    );
  }, [shareToken, username, playlist.id]);

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

        // Handle artwork changes
        let hasArtwork = playlist.hasArtwork;
        if (artworkFile) {
          const formData = new FormData();
          formData.append("artwork", artworkFile);
          const artResult = await updatePlaylistArtwork(playlist.id, formData);
          if (artResult.error) {
            toast.error(artResult.error);
          } else {
            hasArtwork = true;
          }
        } else if (removeArt && playlist.hasArtwork) {
          const artResult = await removePlaylistArtwork(playlist.id);
          if (artResult.error) {
            toast.error(artResult.error);
          } else {
            hasArtwork = false;
          }
        }

        toast.success("Playlist updated");
        onUpdated?.({
          name: trimmedName,
          description: trimmedDesc ?? null,
          isPublic,
          hasArtwork,
          shareToken,
        });
        handleOpenChange(false);
      } catch {
        setError("Something went wrong");
        setIsSubmitting(false);
      }
    },
    [
      name,
      description,
      isPublic,
      playlist.id,
      playlist.hasArtwork,
      artworkFile,
      removeArt,
      shareToken,
      onUpdated,
      handleOpenChange,
    ]
  );

  // Determine artwork preview source
  const artworkSrc = artworkPreview
    ? artworkPreview
    : !removeArt && playlist.hasArtwork
      ? `/api/playlist/artwork?playlistId=${playlist.id}`
      : null;

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
        className="sm:max-w-md"
        header={header}
        footer={footer}
      >
        <form
          id="edit-playlist-form"
          onSubmit={handleSubmit}
          className="space-y-4 py-2"
        >
          {/* Artwork section */}
          <div className="space-y-2">
            <Label>Artwork</Label>
            <FileUpload
              value={artworkFile ? [artworkFile] : []}
              onValueChange={(files) => {
                if (files.length > 0) handleArtworkDrop(files);
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
                {artworkSrc ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={artworkSrc}
                    alt=""
                    width={128}
                    height={128}
                    className="size-full object-cover"
                  />
                ) : (
                  <div className="flex size-full items-center justify-center">
                    <ListMusic className="text-muted-foreground/40 size-8" />
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
                      <Upload className="size-3.5" />
                    </Button>
                  </FileUploadTrigger>
                  {(artworkSrc || artworkFile) && (
                    <Button
                      type="button"
                      size="icon"
                      variant="secondary"
                      className="size-7 shadow-md"
                      aria-label="Remove artwork"
                      onClick={handleRemoveArtwork}
                    >
                      <X className="size-3.5" />
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

          {/* Description */}
          <div className="space-y-2">
            <Label htmlFor="edit-playlist-description">Description</Label>
            <Textarea
              id="edit-playlist-description"
              data-testid="edit-playlist-description-input"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Add a description\u2026"
              maxLength={1000}
              rows={3}
              disabled={isSubmitting}
            />
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
              checked={isPublic}
              onCheckedChange={setIsPublic}
              disabled={isSubmitting}
            />
          </div>

          {/* Shareable link section (only for non-public playlists) */}
          {!isPublic && (
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
                  checked={!!shareToken}
                  onCheckedChange={handleShareToggle}
                  disabled={isSubmitting}
                />
              </div>

              {shareToken && shareToken !== "pending" && username && (
                <div className="flex items-center gap-2">
                  <div className="relative flex-1">
                    <Link2 className="text-muted-foreground absolute top-1/2 left-2.5 size-3.5 -translate-y-1/2" />
                    <Input
                      readOnly
                      aria-label="Shareable link"
                      value={`${typeof window !== "undefined" ? window.location.origin : ""}/u/${username}/playlists/${playlist.id}?token=${shareToken}`}
                      className="h-8 truncate pl-8 text-xs"
                    />
                  </div>
                  <Button
                    type="button"
                    size="icon"
                    variant="outline"
                    className="size-8 shrink-0"
                    onClick={handleCopyShareLink}
                    aria-label="Copy link"
                  >
                    <Copy className="size-3.5" />
                  </Button>
                  <Button
                    type="button"
                    size="icon"
                    variant="outline"
                    className="size-8 shrink-0"
                    onClick={handleRegenerate}
                    disabled={isRegenerating}
                    aria-label="Regenerate link"
                  >
                    <RefreshCw
                      className={cn(
                        "size-3.5",
                        isRegenerating && "animate-spin"
                      )}
                    />
                  </Button>
                </div>
              )}
            </div>
          )}

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
