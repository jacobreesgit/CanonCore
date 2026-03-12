/**
 * Shared hook for create playlist form state management.
 * Extracted from CreatePlaylistDialog to be reusable by both
 * the desktop dialog and mobile sheet. Manages name, description,
 * visibility, item selection, validation, and submission.
 */

"use client";

import { useState, useCallback } from "react";
import { toast } from "sonner";
import { createPlaylist } from "@/lib/playlist-actions";

/** Playlist visibility options. */
export type PlaylistVisibility = "private" | "unlisted" | "public";

/** Return type for the useCreatePlaylistForm hook. */
export interface UseCreatePlaylistFormReturn {
  // Form state
  name: string;
  setName: (name: string) => void;
  description: string;
  setDescription: (description: string) => void;
  visibility: PlaylistVisibility;
  setVisibility: (visibility: PlaylistVisibility) => void;
  selectedItemIds: Set<string>;
  error: string | null;
  setError: (error: string | null) => void;
  isCreating: boolean;

  // Handlers
  toggleItemId: (id: string) => void;
  handleSubmit: (e: React.FormEvent) => Promise<void>;
  reset: () => void;
}

/**
 * Manages create playlist form state: name, description, visibility,
 * item selection, validation, and server action submission.
 *
 * On successful creation, resets form state, shows a success toast,
 * calls onCreated with the new playlist data, then calls onClose
 * to let the consumer dismiss the dialog/sheet.
 *
 * @param onCreated - Optional callback after successful playlist creation
 * @param onClose - Optional callback to close the dialog after creation
 * @returns Form state, handlers, and reset function
 */
export function useCreatePlaylistForm(
  onCreated?: (playlist: { id: string; name: string }) => void,
  onClose?: () => void
): UseCreatePlaylistFormReturn {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [visibility, setVisibility] = useState<PlaylistVisibility>("private");
  const [selectedItemIds, setSelectedItemIds] = useState<Set<string>>(
    new Set()
  );
  const [error, setError] = useState<string | null>(null);
  const [isCreating, setIsCreating] = useState(false);

  const reset = useCallback(() => {
    setName("");
    setDescription("");
    setVisibility("private");
    setSelectedItemIds(new Set());
    setError(null);
    setIsCreating(false);
  }, []);

  const toggleItemId = useCallback((id: string) => {
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

  const handleSubmit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();

      const trimmed = name.trim();
      if (!trimmed) {
        setError("Name is required");
        return;
      }

      setError(null);
      setIsCreating(true);

      try {
        const result = await createPlaylist(trimmed, {
          description: description.trim() || undefined,
          visibility,
          itemIds:
            selectedItemIds.size > 0 ? Array.from(selectedItemIds) : undefined,
        });

        if (result.error) {
          setError(result.error);
          setIsCreating(false);
          return;
        }

        if (result.success && result.data) {
          toast.success("Playlist created");
          onCreated?.(result.data);
          reset();
          onClose?.();
        }
      } catch {
        setError("Something went wrong");
        setIsCreating(false);
      }
    },
    [name, description, visibility, selectedItemIds, onCreated, onClose, reset]
  );

  return {
    // Form state
    name,
    setName,
    description,
    setDescription,
    visibility,
    setVisibility,
    selectedItemIds,
    error,
    setError,
    isCreating,

    // Handlers
    toggleItemId,
    handleSubmit,
    reset,
  };
}
