/**
 * Grid view content for the items view.
 * Renders editing SortableGrid or view-mode pinned/unpinned sections
 * with context menus and poster cards.
 */

"use client";

import dynamic from "next/dynamic";
import type { UniqueIdentifier } from "@dnd-kit/core";
import { Section } from "@/components/ui/section";
import { Skeleton } from "@/components/ui/skeleton";
import { ItemContextMenu } from "./item-context-menu";
import { GridItem } from "@/components/sortable-grid/grid-item";
import type { ItemWithArtwork } from "@/lib/types";
import type { CreateItemResult } from "./add-item-dialog";

/** Loading skeleton for grid view during edit mode chunk load. */
function GridSkeleton() {
  return (
    <div className="grid grid-cols-1 gap-4 md:grid-cols-3 lg:grid-cols-5">
      {Array.from({ length: 8 }).map((_, i) => (
        <Skeleton key={i} className="aspect-[2/3] w-full rounded-lg" />
      ))}
    </div>
  );
}

// Dynamic import for edit mode (~15KB dnd-kit loaded on demand)
const SortableGrid = dynamic(
  () => import("@/components/sortable-grid").then((mod) => mod.SortableGrid),
  { loading: () => <GridSkeleton />, ssr: false }
);

interface CurrentUser {
  id: string;
  username: string | null;
  name: string | null;
}

interface GridViewContentProps {
  /** Whether edit/reorder mode is active. */
  isEditing: boolean;
  /** Items at the current hierarchy level (sorted + filtered). */
  currentLevelItems: ItemWithArtwork[];
  /** Pinned items (sorted by pinnedOrder). */
  pinnedItems: ItemWithArtwork[];
  /** Unpinned items. */
  unpinnedItems: ItemWithArtwork[];
  /** Callback when grid items are reordered in edit mode. */
  onItemsChange: (items: ItemWithArtwork[]) => Promise<void>;
  /** Callback when an item is clicked (navigates to detail). */
  onItemClick: (id: UniqueIdentifier) => void;
  /** Callback to open settings dialog for an item. */
  onOpenSettings: (id: string) => Promise<void>;
  /** Callback to delete an item. */
  onDeleteItem: (id: string) => Promise<void>;
  /** Callback to pin an item to the sidebar. */
  onPinItem: (id: string) => Promise<void>;
  /** Callback to unpin an item from the sidebar. */
  onUnpinItem: (id: string) => Promise<void>;
  /** Callback to add a child item. */
  onAddChild?(
    parentId: string,
    name: string,
    description?: string
  ): Promise<CreateItemResult>;
  /** Callback to refresh data after child item is created. */
  onAddChildComplete?(): Promise<void>;
  /** Whether Google Drive is connected. */
  hasDriveConnection: boolean;
  /** Check if an item is selected (for bulk operations). */
  isItemSelected: (id: string) => boolean;
  /** Callback when item selection changes. */
  onItemSelectChange: (id: string, selected: boolean) => void;
  /** Current user info for owner display in grid items. */
  currentUser?: CurrentUser | null;
}

/**
 * Grid view content with editing and view modes.
 * Edit mode: SortableGrid with drag-and-drop reordering.
 * View mode: Pinned items section + Library section with context menus.
 */
export function GridViewContent({
  isEditing,
  currentLevelItems,
  pinnedItems,
  unpinnedItems,
  onItemsChange,
  onItemClick,
  onOpenSettings,
  onDeleteItem,
  onPinItem,
  onUnpinItem,
  onAddChild,
  onAddChildComplete,
  hasDriveConnection,
  isItemSelected,
  onItemSelectChange,
  currentUser,
}: GridViewContentProps) {
  if (isEditing) {
    return (
      <Section className="py-8" aria-label="Contents">
        <SortableGrid
          items={currentLevelItems}
          onItemsChange={onItemsChange}
          onItemClick={onItemClick}
          onOpenSettings={onOpenSettings}
          onDeleteItem={onDeleteItem}
          hasDriveConnection={hasDriveConnection}
          onPinItem={onPinItem}
          onUnpinItem={onUnpinItem}
          isItemSelected={isItemSelected}
          onItemSelectChange={onItemSelectChange}
          currentUser={currentUser}
        />
      </Section>
    );
  }

  return (
    <div className="flex flex-col">
      {/* Pinned items section */}
      {pinnedItems.length > 0 && (
        <Section className="py-8" aria-label="Pinned items">
          <h2 className="mb-4 text-xs font-medium tracking-[0.2em] text-[var(--tertiary-foreground)] uppercase">
            Pinned
          </h2>
          <div className="stagger-grid grid grid-cols-2 gap-4 md:grid-cols-4 lg:grid-cols-6">
            {pinnedItems.map((item, index) => (
              <ItemContextMenu
                key={item.id}
                itemName={item.name}
                driveFileId={item.driveFileId}
                showAddChild={true}
                isPinned={true}
                onSettings={() => onOpenSettings(item.id)}
                onDelete={() => onDeleteItem(item.id)}
                onAddChild={
                  onAddChild ? (n, d) => onAddChild(item.id, n, d) : undefined
                }
                onAddChildComplete={onAddChildComplete}
                hasDriveConnection={hasDriveConnection}
                onPin={() => onPinItem(item.id)}
                onUnpin={() => onUnpinItem(item.id)}
              >
                <GridItem
                  id={item.id}
                  name={item.name}
                  description={item.description}
                  onClick={() => onItemClick(item.id)}
                  tmdbPosterPath={item.tmdbPosterPath}
                  artworkId={item.artworkId}
                  progressPercentage={item.progress?.percentage ?? null}
                  watchedCount={item.progress?.watchedItems}
                  totalMediaCount={item.progress?.itemsWithMedia}
                  totalItems={item.progress?.totalItems}
                  showArtwork={true}
                  showDescription={true}
                  priority={index < 5}
                  moreMenuProps={{
                    itemName: item.name,
                    driveFileId: item.driveFileId,
                    hasDriveConnection,
                    isPinned: true,
                    showAddChild: true,
                    onSettings: () => onOpenSettings(item.id),
                    onDelete: () => onDeleteItem(item.id),
                    onAddChild: onAddChild
                      ? (n, d) => onAddChild(item.id, n, d)
                      : undefined,
                    onAddChildComplete,
                    onPin: () => onPinItem(item.id),
                    onUnpin: () => onUnpinItem(item.id),
                  }}
                />
              </ItemContextMenu>
            ))}
          </div>
        </Section>
      )}

      {/* Library section (items not pinned) */}
      {unpinnedItems.length > 0 && (
        <Section className="py-8" aria-label="Library">
          {pinnedItems.length > 0 && (
            <h2 className="mb-4 text-xs font-medium tracking-[0.2em] text-[var(--tertiary-foreground)] uppercase">
              Library
            </h2>
          )}
          <div className="stagger-grid grid grid-cols-2 gap-4 md:grid-cols-4 lg:grid-cols-6">
            {unpinnedItems.map((item, index) => (
              <ItemContextMenu
                key={item.id}
                itemName={item.name}
                driveFileId={item.driveFileId}
                showAddChild={true}
                isPinned={false}
                onSettings={() => onOpenSettings(item.id)}
                onDelete={() => onDeleteItem(item.id)}
                onAddChild={
                  onAddChild ? (n, d) => onAddChild(item.id, n, d) : undefined
                }
                onAddChildComplete={onAddChildComplete}
                hasDriveConnection={hasDriveConnection}
                onPin={() => onPinItem(item.id)}
                onUnpin={() => onUnpinItem(item.id)}
              >
                <GridItem
                  id={item.id}
                  name={item.name}
                  description={item.description}
                  onClick={() => onItemClick(item.id)}
                  tmdbPosterPath={item.tmdbPosterPath}
                  artworkId={item.artworkId}
                  progressPercentage={item.progress?.percentage ?? null}
                  watchedCount={item.progress?.watchedItems}
                  totalMediaCount={item.progress?.itemsWithMedia}
                  totalItems={item.progress?.totalItems}
                  showArtwork={true}
                  showDescription={true}
                  priority={index < 8}
                  moreMenuProps={{
                    itemName: item.name,
                    driveFileId: item.driveFileId,
                    hasDriveConnection,
                    isPinned: false,
                    showAddChild: true,
                    onSettings: () => onOpenSettings(item.id),
                    onDelete: () => onDeleteItem(item.id),
                    onAddChild: onAddChild
                      ? (n, d) => onAddChild(item.id, n, d)
                      : undefined,
                    onAddChildComplete,
                    onPin: () => onPinItem(item.id),
                    onUnpin: () => onUnpinItem(item.id),
                  }}
                />
              </ItemContextMenu>
            ))}
          </div>
        </Section>
      )}
    </div>
  );
}
