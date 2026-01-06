/**
 * Context for the global Quick Create dialog.
 * Manages dialog state for sidebar Quick Create button.
 * Uses subscription pattern to notify consumers when items are created.
 */

"use client";

import {
  createContext,
  useContext,
  useState,
  useCallback,
  useRef,
  ReactNode,
} from "react";
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
  /** Subscribe to item creation events. Returns unsubscribe function. */
  subscribeToCreation: (callback: () => void) => () => void;
}

const QuickCreateContext = createContext<QuickCreateContextValue | null>(null);

/**
 * Provider for Quick Create dialog state.
 * Handles item creation at root level.
 * Notifies subscribers after successful creation for explicit refetch.
 */
export function QuickCreateProvider({ children }: { children: ReactNode }) {
  const [isOpen, setIsOpen] = useState(false);
  const creationListeners = useRef<Set<() => void>>(new Set());

  const openDialog = useCallback(() => setIsOpen(true), []);
  const closeDialog = useCallback(() => setIsOpen(false), []);

  const subscribeToCreation = useCallback((callback: () => void) => {
    creationListeners.current.add(callback);
    return () => {
      creationListeners.current.delete(callback);
    };
  }, []);

  const handleCreate = useCallback(
    async (name: string, description?: string): Promise<string | undefined> => {
      try {
        const result = await createItem(null, name, description);
        if (result.success && result.data) {
          toast.success(`Created "${name}"`);
          // Notify all subscribers to refetch their data
          creationListeners.current.forEach((callback) => callback());
          return undefined;
        }
        toast.error(result.error || "Failed to create item");
        return result.error;
      } catch (error) {
        const message =
          error instanceof Error ? error.message : "Failed to create item";
        toast.error(message);
        return message;
      }
    },
    []
  );

  return (
    <QuickCreateContext.Provider
      value={{
        isOpen,
        openDialog,
        closeDialog,
        handleCreate,
        subscribeToCreation,
      }}
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
 * Use when component may render outside protected routes.
 */
export function useQuickCreateOptional() {
  return useContext(QuickCreateContext);
}
