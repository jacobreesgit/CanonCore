/**
 * Client-side providers for the protected routes.
 * Wraps children with context providers and global dialogs.
 */

"use client";

import { ReactNode } from "react";
import {
  QuickCreateProvider,
  useQuickCreate,
} from "@/contexts/add-item-context";
import { AddItemDialog } from "@/components/items/add-item-dialog";

/**
 * Global Add Item dialog for Quick Create.
 * Opens via sidebar button, creates items at root level.
 */
function GlobalAddItemDialog() {
  const { isOpen, closeDialog, handleCreate } = useQuickCreate();

  return (
    <AddItemDialog
      open={isOpen}
      onOpenChange={(open) => !open && closeDialog()}
      onAdd={handleCreate}
    />
  );
}

/**
 * Protected routes providers wrapper.
 * Provides Quick Create context and renders global dialog.
 */
export function MyItemsProviders({ children }: { children: ReactNode }) {
  return (
    <QuickCreateProvider>
      {children}
      <GlobalAddItemDialog />
    </QuickCreateProvider>
  );
}
