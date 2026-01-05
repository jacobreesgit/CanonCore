/**
 * Client-side providers for the dashboard.
 * Wraps children with context providers and global dialogs.
 */

"use client";

import { ReactNode } from "react";
import {
  QuickCreateProvider,
  useQuickCreate,
} from "@/contexts/add-folder-context";
import { AddFolderDialog } from "@/components/items/add-folder-dialog";

/**
 * Global Add Folder dialog for Quick Create.
 * Opens via sidebar button, creates folders at dashboard root.
 */
function GlobalAddFolderDialog() {
  const { isOpen, closeDialog, handleCreate } = useQuickCreate();

  return (
    <AddFolderDialog
      open={isOpen}
      onOpenChange={(open) => !open && closeDialog()}
      onAdd={handleCreate}
    />
  );
}

/**
 * Dashboard providers wrapper.
 * Provides Quick Create context and renders global dialog.
 */
export function DashboardProviders({ children }: { children: ReactNode }) {
  return (
    <QuickCreateProvider>
      {children}
      <GlobalAddFolderDialog />
    </QuickCreateProvider>
  );
}
