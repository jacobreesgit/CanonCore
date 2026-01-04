/**
 * View-only tree container for hierarchical items display.
 * Renders items with full visual richness (artwork, sync badges).
 * No drag-and-drop functionality - use SortableTree for edit mode.
 */

"use client";

import React, { useMemo } from "react";

import { TreeItem } from "./components/TreeItem/TreeItem";
import { ItemContextMenu } from "@/components/items/item-context-menu";
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
  onAddChild?(parentId: string, name: string): Promise<string | undefined>;
  /** Indentation width per depth level. Defaults to 20. */
  indentationWidth?: number;
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
  indentationWidth = 20,
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
    <ul data-testid="items-tree-view" className="space-y-0.5">
      {flattenedItems.map(
        ({ id, name, description, children, depth, sftpPath, artworkId }) => (
          <ItemContextMenu
            key={id}
            itemName={name}
            onSettings={
              onOpenSettings ? () => onOpenSettings(String(id)) : undefined
            }
            onDelete={onDeleteItem ? () => onDeleteItem(String(id)) : undefined}
            onAddChild={
              onAddChild
                ? (childName) => onAddChild(String(id), childName)
                : undefined
            }
          >
            <TreeItem
              id={id}
              value={name}
              description={description}
              depth={depth}
              indentationWidth={indentationWidth}
              collapsed={isCollapsed(id)}
              onCollapse={
                children.length > 0 ? () => toggleCollapse(id) : undefined
              }
              onClick={() => onItemClick?.(String(id))}
              sftpPath={sftpPath}
              artworkId={artworkId}
              showArtwork={true}
              showDragHandle={false}
              showDescription={true}
            />
          </ItemContextMenu>
        )
      )}
    </ul>
  );
}
