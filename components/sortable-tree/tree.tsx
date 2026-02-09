/**
 * View-only tree container for hierarchical items display.
 * Renders items with full visual richness (artwork, sync badges).
 * No drag-and-drop functionality - use SortableTree for edit mode.
 */

"use client";

import React, { useMemo } from "react";

import { TreeItem } from "./components/tree-item/tree-item";
import { ItemContextMenu } from "@/components/items/item-context-menu";
import type { CreateItemResult } from "@/components/items/add-item-dialog";
import { useTreeCollapse } from "@/hooks/use-tree-collapse";
import { flattenTree, removeChildrenOf } from "./utilities";
import type { TreeItems } from "@/lib/types";
import type { UniqueIdentifier } from "@dnd-kit/core";

interface TreeProps {
  /** Tree items to display. */
  items: TreeItems;
  /** Callback when an item is clicked. */
  onItemClick?(id: string): void;
  /** Callback to open settings dialog for an item. */
  onOpenSettings?(id: string): void;
  /** Callback to delete an item. */
  onDeleteItem?(id: string): Promise<void>;
  /** Callback to add a child item. */
  onAddChild?(
    parentId: string,
    name: string,
    description?: string
  ): Promise<CreateItemResult>;
  /** Callback to refresh data after child item is created. */
  onAddChildComplete?(): Promise<void>;
  /** Whether user has Google Drive connected (for file uploads in Add Child dialog). */
  hasDriveConnection?: boolean;
  /** Indentation width per depth level. Defaults to 44 (matches left-edge-to-content). */
  indentationWidth?: number;
  /** Callback to pin an item to the sidebar. */
  onPinItem?(id: string): Promise<void>;
  /** Callback to unpin an item from the sidebar. */
  onUnpinItem?(id: string): Promise<void>;
}

/**
 * View-only tree component for browsing hierarchical items.
 * Shows artwork thumbnails, sync badges, and collapse/expand.
 * No drag handles - for reordering, use SortableTree in edit mode.
 *
 * @param props - Tree properties
 */
export function Tree({
  items,
  onItemClick,
  onOpenSettings,
  onDeleteItem,
  onAddChild,
  onAddChildComplete,
  hasDriveConnection = false,
  indentationWidth = 44,
  onPinItem,
  onUnpinItem,
}: TreeProps) {
  const { isCollapsed, toggleCollapse } = useTreeCollapse(items);

  // Flatten tree and remove children of collapsed items
  const flattenedItems = useMemo(() => {
    const flattened = flattenTree(items);
    const collapsedIds = flattened.reduce<UniqueIdentifier[]>(
      (acc, { children, id }) =>
        isCollapsed(id) && children.length ? [...acc, id] : acc,
      []
    );
    return removeChildrenOf(flattened, collapsedIds);
  }, [items, isCollapsed]);

  return (
    <ul data-testid="items-tree-view" className="space-y-1">
      {flattenedItems.map(
        ({
          id,
          name,
          description,
          children,
          depth,
          pinnedOrder,
          driveFileId,
          fileCounts,
          childCount,
          mediaIconType,
          progressPercentage,
          watchedCount,
          totalMediaCount,
          totalItems,
        }) => (
          <ItemContextMenu
            key={id}
            itemName={name}
            driveFileId={driveFileId}
            hasDriveConnection={hasDriveConnection}
            isPinned={pinnedOrder != null}
            onSettings={
              onOpenSettings ? () => onOpenSettings(String(id)) : undefined
            }
            onDelete={onDeleteItem ? () => onDeleteItem(String(id)) : undefined}
            onAddChild={
              onAddChild
                ? (childName, childDescription) =>
                    onAddChild(String(id), childName, childDescription)
                : undefined
            }
            onAddChildComplete={onAddChildComplete}
            onPin={onPinItem ? () => onPinItem(String(id)) : undefined}
            onUnpin={onUnpinItem ? () => onUnpinItem(String(id)) : undefined}
          >
            <TreeItem
              id={id}
              value={name}
              description={description}
              depth={depth}
              indentationWidth={indentationWidth}
              collapsed={isCollapsed(id)}
              childCount={childCount}
              onCollapse={
                children.length > 0 ? () => toggleCollapse(id) : undefined
              }
              onClick={() => onItemClick?.(String(id))}
              showDragHandle={false}
              fileCounts={fileCounts}
              mediaIconType={mediaIconType}
              progressPercentage={progressPercentage}
              watchedCount={watchedCount}
              totalMediaCount={totalMediaCount}
              totalItems={totalItems}
              moreMenuProps={{
                itemName: name,
                driveFileId,
                hasDriveConnection,
                isPinned: pinnedOrder != null,
                showAddChild: true,
                onSettings: onOpenSettings
                  ? () => onOpenSettings(String(id))
                  : undefined,
                onDelete: onDeleteItem
                  ? () => onDeleteItem(String(id))
                  : undefined,
                onAddChild: onAddChild
                  ? (n, d) => onAddChild(String(id), n, d)
                  : undefined,
                onAddChildComplete,
                onPin: onPinItem ? () => onPinItem(String(id)) : undefined,
                onUnpin: onUnpinItem
                  ? () => onUnpinItem(String(id))
                  : undefined,
              }}
            />
          </ItemContextMenu>
        )
      )}
    </ul>
  );
}
