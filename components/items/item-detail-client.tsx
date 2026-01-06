/**
 * Client-side wrapper for item detail pages.
 * Manages shared state between ItemsToolbar and ItemsView.
 * Provides unified toolbar with Settings, Sync, and content actions.
 * Supports optional tabs when both files and children exist.
 */

"use client";

import { useState, useCallback, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ItemsToolbar } from "./items-toolbar";
import { ItemsView } from "./items-view";
import { ItemDetail } from "./item-detail";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Folder, Film } from "lucide-react";
import type { ItemWithArtwork, SerializedItemFile } from "@/lib/types";
import { getItems } from "@/lib/item-actions";
import { getItemsByConnection } from "@/lib/sftp-actions";

interface ItemDetailClientProps {
  /** Current item being viewed. */
  item: {
    id: string;
    name: string;
    description: string | null;
    connectionId: string | null;
    sftpPath: string | null;
  };
  /** Child items to display. */
  childItems: ItemWithArtwork[];
  /** Parent connection info for context. */
  connection?: { id: string; name: string } | null;
  /** Optional files for tabbed view. */
  files?: {
    media: SerializedItemFile[];
    artwork: SerializedItemFile[];
    subtitles: SerializedItemFile[];
  };
}

/**
 * Client wrapper for item detail page with unified toolbar.
 * Manages edit mode and add item dialog state shared between toolbar and view.
 * When files are provided, shows tabs for navigating between media and subfolders.
 */
export function ItemDetailClient({
  item,
  childItems: initialChildItems,
  connection,
  files,
}: ItemDetailClientProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [childItems, setChildItems] = useState(initialChildItems);
  const [isEditing, setIsEditing] = useState(false);
  const [addItemOpen, setAddItemOpen] = useState(false);

  const isSftpConnected = Boolean(item.connectionId && item.sftpPath);
  const hasFiles =
    files &&
    (files.media.length > 0 ||
      files.artwork.length > 0 ||
      files.subtitles.length > 0);
  const hasChildren = childItems.length > 0;

  /**
   * Refetches child items from server.
   */
  const refetchItems = useCallback(async () => {
    startTransition(async () => {
      const result = item.connectionId
        ? await getItemsByConnection(item.connectionId, item.id)
        : await getItems(item.id);

      if (result.success && result.data) {
        setChildItems(result.data);
      }
    });
  }, [item.id, item.connectionId]);

  /**
   * Handles sync completion - refresh items and page.
   */
  const handleSyncComplete = useCallback(async () => {
    await refetchItems();
    router.refresh();
  }, [refetchItems, router]);

  // Shared toolbar props to avoid duplication between tabbed and standard views
  const toolbarProps = {
    hasItems: hasChildren,
    isEditing,
    onEditToggle: () => setIsEditing((prev) => !prev),
    onAddItem: () => setAddItemOpen(true),
    onSyncComplete: handleSyncComplete,
    item: {
      id: item.id,
      name: item.name,
      description: item.description,
    },
    childCount: childItems.length,
    isSftpConnected,
  };

  // Tabbed view when both files and children exist
  if (hasFiles && hasChildren) {
    return (
      <div className={`flex flex-col gap-6 ${isPending ? "opacity-70" : ""}`}>
        <ItemsToolbar {...toolbarProps} />

        <Tabs defaultValue="files" className="w-full">
          <TabsList className="mb-6">
            <TabsTrigger value="files" className="gap-2">
              <Film className="size-4" />
              Media ({files.media.length})
            </TabsTrigger>
            <TabsTrigger value="folders" className="gap-2">
              <Folder className="size-4" />
              Subfolders ({childItems.length})
            </TabsTrigger>
          </TabsList>

          <TabsContent value="files">
            <ItemDetail item={item} files={files} />
          </TabsContent>

          <TabsContent value="folders">
            <ItemsView
              items={childItems}
              parentId={item.id}
              connectionId={item.connectionId}
              hideToolbar
              isEditing={isEditing}
              onEditingChange={setIsEditing}
              addItemOpen={addItemOpen}
              onAddItemOpenChange={setAddItemOpen}
              currentConnection={connection}
              onSyncComplete={refetchItems}
            />
          </TabsContent>
        </Tabs>
      </div>
    );
  }

  // Standard view without tabs (no files, or no children)
  return (
    <div className={`flex flex-col gap-6 ${isPending ? "opacity-70" : ""}`}>
      <ItemsToolbar {...toolbarProps} />

      <ItemsView
        items={childItems}
        parentId={item.id}
        connectionId={item.connectionId}
        hideToolbar
        isEditing={isEditing}
        onEditingChange={setIsEditing}
        addItemOpen={addItemOpen}
        onAddItemOpenChange={setAddItemOpen}
        currentConnection={connection}
        onSyncComplete={refetchItems}
      />
    </div>
  );
}
