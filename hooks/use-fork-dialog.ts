"use client";

import { useState, useCallback } from "react";
import { toast } from "sonner";
import { forkItem } from "@/lib/fork-actions";

interface UseForkDialogOptions {
  /** Called after a successful fork (e.g., router.refresh). */
  onSuccess?: (result: { itemId: string }) => void;
  /**
   * If true, suppress the default toast and let the caller handle it
   * via onSuccess. Useful when a custom toast (e.g. with an action button)
   * is needed.
   */
  suppressToast?: boolean;
}

export function useForkDialog(options?: UseForkDialogOptions) {
  const [open, setOpen] = useState(false);
  const [itemId, setItemId] = useState<string | null>(null);
  const [itemName, setItemName] = useState("");
  const [isForking, setIsForking] = useState(false);

  const openDialog = useCallback((id: string, name: string) => {
    setItemId(id);
    setItemName(name);
    setOpen(true);
  }, []);

  const handleConfirm = useCallback(
    async (parentId: string | null) => {
      if (!itemId) return;

      setIsForking(true);
      try {
        const result = await forkItem(itemId, parentId);
        if (result.success) {
          if (!options?.suppressToast) {
            toast.success(`Forked "${itemName}" to your library`);
          }
          setOpen(false);
          if (result.data) {
            options?.onSuccess?.(result.data);
          }
        } else {
          toast.error(result.error ?? "Failed to fork item");
        }
      } catch {
        toast.error("Failed to fork item");
      } finally {
        setIsForking(false);
      }
    },
    [itemId, itemName, options]
  );

  return {
    open,
    setOpen,
    itemName,
    isForking,
    openDialog,
    handleConfirm,
  };
}
