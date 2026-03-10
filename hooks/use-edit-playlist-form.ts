/**
 * Shared hook for edit playlist form state management.
 * Extracted from EditPlaylistDialog to be reusable by both
 * the desktop dialog and mobile sheet. Manages name, description,
 * visibility, artwork, share token, validation, and submission.
 */

"use client";

import { useState, useCallback, useEffect } from "react";
import { toast } from "sonner";
import {
  updatePlaylist,
  updatePlaylistArtwork,
  removePlaylistArtwork,
  regenerateShareToken,
} from "@/lib/playlist-actions";

/** Playlist data required to populate the edit form. */
export interface EditPlaylistData {
  id: string;
  name: string;
  description: string | null;
  isPublic?: boolean;
  hasArtwork?: boolean;
  shareToken?: string | null;
}

/** Data returned to the parent after a successful update. */
export interface EditPlaylistResult {
  name: string;
  description: string | null;
  isPublic?: boolean;
  hasArtwork?: boolean;
  shareToken?: string | null;
}

/** Return type for the useEditPlaylistForm hook. */
export interface UseEditPlaylistFormReturn {
  // Form state
  name: string;
  setName: (name: string) => void;
  description: string;
  setDescription: (description: string) => void;
  isPublic: boolean;
  setIsPublic: (isPublic: boolean) => void;
  error: string | null;
  setError: (error: string | null) => void;
  isSubmitting: boolean;

  // Artwork state
  artworkFile: File | null;
  artworkPreview: string | null;
  removeArt: boolean;
  artworkSrc: string | null;
  handleArtworkDrop: (files: File[]) => void;
  handleRemoveArtwork: () => void;

  // Share token state
  shareToken: string | null;
  isRegenerating: boolean;
  handleShareToggle: (enabled: boolean) => Promise<void>;
  handleRegenerate: () => Promise<void>;
  handleCopyShareLink: () => void;

  // Handlers
  handleSubmit: (e: React.FormEvent) => Promise<void>;
  reset: () => void;
}

/**
 * Manages edit playlist form state: name, description, visibility,
 * artwork upload/removal, share token management, validation,
 * and server action submission.
 */
export function useEditPlaylistForm(
  playlist: EditPlaylistData,
  username?: string,
  onUpdated?: (data: EditPlaylistResult) => void,
  onClose?: () => void
): UseEditPlaylistFormReturn {
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

  const reset = useCallback(() => {
    setName(playlist.name);
    setDescription(playlist.description ?? "");
    setIsPublic(playlist.isPublic ?? true);
    setArtworkFile(null);
    setArtworkPreview(null);
    setRemoveArt(false);
    setShareToken(playlist.shareToken ?? null);
    setError(null);
    setIsSubmitting(false);
  }, [
    playlist.name,
    playlist.description,
    playlist.isPublic,
    playlist.shareToken,
  ]);

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
        reset();
        onClose?.();
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
      onClose,
      reset,
    ]
  );

  // Determine artwork preview source
  const artworkSrc = artworkPreview
    ? artworkPreview
    : !removeArt && playlist.hasArtwork
      ? `/api/playlist/artwork?playlistId=${playlist.id}`
      : null;

  return {
    // Form state
    name,
    setName,
    description,
    setDescription,
    isPublic,
    setIsPublic,
    error,
    setError,
    isSubmitting,

    // Artwork state
    artworkFile,
    artworkPreview,
    removeArt,
    artworkSrc,
    handleArtworkDrop,
    handleRemoveArtwork,

    // Share token state
    shareToken,
    isRegenerating,
    handleShareToggle,
    handleRegenerate,
    handleCopyShareLink,

    // Handlers
    handleSubmit,
    reset,
  };
}
