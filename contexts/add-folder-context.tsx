/**
 * Context for the global Quick Create dialog.
 * Manages dialog state for sidebar Quick Create button.
 */

"use client";

import {
  createContext,
  useContext,
  useState,
  useCallback,
  ReactNode,
} from "react";
import { useRouter } from "next/navigation";
import { createItem } from "@/lib/item-actions";
import { toast } from "sonner";

interface QuickCreateContextValue {
  isOpen: boolean;
  openDialog: () => void;
  closeDialog: () => void;
  handleCreate: (
    name: string,
    description?: string
  ) => Promise<string | undefined>;
}

const QuickCreateContext = createContext<QuickCreateContextValue | null>(null);

/**
 * Provider for Quick Create dialog state.
 * Handles folder creation at dashboard root level.
 */
export function QuickCreateProvider({ children }: { children: ReactNode }) {
  const [isOpen, setIsOpen] = useState(false);
  const router = useRouter();

  const openDialog = useCallback(() => setIsOpen(true), []);
  const closeDialog = useCallback(() => setIsOpen(false), []);

  const handleCreate = useCallback(
    async (name: string, description?: string): Promise<string | undefined> => {
      try {
        const result = await createItem(null, name, description);
        if (result.success && result.data) {
          toast.success(`Created "${name}"`);
          router.refresh();
          return undefined;
        }
        toast.error(result.error || "Failed to create folder");
        return result.error;
      } catch (error) {
        const message =
          error instanceof Error ? error.message : "Failed to create folder";
        toast.error(message);
        return message;
      }
    },
    [router]
  );

  return (
    <QuickCreateContext.Provider
      value={{ isOpen, openDialog, closeDialog, handleCreate }}
    >
      {children}
    </QuickCreateContext.Provider>
  );
}

/**
 * Hook to access Quick Create dialog controls.
 * Throws if used outside QuickCreateProvider.
 */
export function useQuickCreate() {
  const context = useContext(QuickCreateContext);
  if (!context) {
    throw new Error("useQuickCreate must be used within QuickCreateProvider");
  }
  return context;
}

/**
 * Optional hook that returns null if outside provider.
 * Use when component may render outside dashboard context.
 */
export function useQuickCreateOptional() {
  return useContext(QuickCreateContext);
}
