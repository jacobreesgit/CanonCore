/**
 * Sortable tree container with full drag-and-drop functionality.
 * Supports nesting, reordering, and keyboard navigation.
 */

"use client";

import React, {
  useEffect,
  useMemo,
  useRef,
  useState,
  useCallback,
} from "react";
import { createPortal } from "react-dom";
import {
  Announcements,
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragStartEvent,
  DragOverlay,
  DragMoveEvent,
  DragEndEvent,
  DragOverEvent,
  MeasuringStrategy,
  DropAnimation,
  UniqueIdentifier,
  defaultDropAnimation,
} from "@dnd-kit/core";
import {
  SortableContext,
  arrayMove,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";

import {
  buildTree,
  flattenTree,
  getProjection,
  getChildCount,
  removeChildrenOf,
  setProperty,
} from "./utilities";
import type { FlattenedItem, SensorContext, TreeItems } from "@/lib/types";
import type { CreateItemResult } from "@/components/items/add-item-dialog";
import { sortableTreeKeyboardCoordinates } from "./keyboardCoordinates";
import { SortableTreeItem, TreeItem } from "./components";
import { ReparentWarningDialog } from "@/components/items/reparent-warning-dialog";

/** State for a pending drag-and-drop move that requires user confirmation. */
interface PendingMoveState {
  activeId: UniqueIdentifier;
  overId: UniqueIdentifier;
  depth: number;
  parentId: UniqueIdentifier | null;
  itemName: string;
  oldParentName: string | null;
  newParentName: string | null;
  willBecomePublic: boolean;
  willBecomePrivate: boolean;
  clonedItems: FlattenedItem[];
}

const measuring = {
  droppable: {
    strategy: MeasuringStrategy.Always,
  },
};

const dropAnimationConfig: DropAnimation = {
  keyframes({ transform }) {
    return [
      { opacity: 1, transform: CSS.Transform.toString(transform.initial) },
      {
        opacity: 0,
        transform: CSS.Transform.toString({
          ...transform.final,
          x: transform.final.x + 5,
          y: transform.final.y + 5,
        }),
      },
    ];
  },
  easing: "ease-out",
  sideEffects({ active }) {
    active.node.animate([{ opacity: 0 }, { opacity: 1 }], {
      duration: defaultDropAnimation.duration,
      easing: defaultDropAnimation.easing,
    });
  },
};

interface SortableTreeProps {
  items: TreeItems;
  onItemsChange?(items: TreeItems): void;
  onItemClick?(id: UniqueIdentifier): void;
  /** Opens the settings dialog for an item */
  onOpenSettings?(id: string): void;
  onDeleteItem?(id: string): Promise<void>;
  onAddChild?(
    parentId: string,
    name: string,
    description?: string
  ): Promise<CreateItemResult>;
  /** Callback to refresh data after child item is created */
  onAddChildComplete?(): Promise<void>;
  collapsible?: boolean;
  indentationWidth?: number;
  indicator?: boolean;
  maxDepth?: number;
  /** Whether user has Google Drive connected (for Add Child dialog) */
  hasDriveConnection?: boolean;
  /** Callback to pin an item to the sidebar. */
  onPinItem?(id: string): Promise<void>;
  /** Callback to unpin an item from the sidebar. */
  onUnpinItem?(id: string): Promise<void>;
  /** Check if an item is selected (for bulk operations). */
  isItemSelected?: (id: string) => boolean;
  /** Callback when an item's selection state changes. */
  onItemSelectChange?: (id: string, selected: boolean) => void;
  /** Whether edit/reorder mode is active. When false, DnD is disabled and view-mode visuals shown. */
  isEditing?: boolean;
}

/**
 * Drag-and-drop sortable tree for hierarchical item reordering.
 * Uses dnd-kit with keyboard navigation and accessibility announcements.
 *
 * @param items - Tree items to display and reorder
 * @param onItemsChange - Callback when tree structure changes
 * @param onItemClick - Callback when an item is clicked
 * @param onOpenSettings - Callback to open settings dialog
 * @param onDeleteItem - Callback to delete an item
 * @param onAddChild - Callback to add a child item
 * @param collapsible - Whether items can be collapsed
 * @param indentationWidth - Pixels per depth level (default: 44, matches left-edge-to-content)
 * @param indicator - Show depth indicator line
 * @param maxDepth - Maximum nesting depth (default: 10)
 */
export function SortableTree({
  items: defaultItems,
  onItemsChange,
  onItemClick,
  onOpenSettings,
  onDeleteItem,
  onAddChild,
  onAddChildComplete,
  collapsible = true,
  indentationWidth = 44,
  indicator = true,
  maxDepth = 10,
  hasDriveConnection = false,
  onPinItem,
  onUnpinItem,
  isItemSelected,
  onItemSelectChange,
  isEditing = true,
}: SortableTreeProps) {
  const [items, setItems] = useState(() => defaultItems);
  const [activeId, setActiveId] = useState<UniqueIdentifier | null>(null);
  const [overId, setOverId] = useState<UniqueIdentifier | null>(null);
  const [offsetLeft, setOffsetLeft] = useState(0);
  const [currentPosition, setCurrentPosition] = useState<{
    parentId: UniqueIdentifier | null;
    overId: UniqueIdentifier;
  } | null>(null);

  // State for reparent warning dialog
  const [showReparentWarning, setShowReparentWarning] = useState(false);
  const [pendingMove, setPendingMove] = useState<PendingMoveState | null>(null);

  // Sync with external items
  useEffect(() => {
    setItems(defaultItems);
  }, [defaultItems]);

  const flattenedItems = useMemo(() => {
    const flattenedTree = flattenTree(items);
    const collapsedItems = flattenedTree.reduce<UniqueIdentifier[]>(
      (acc, { children, collapsed, id }) =>
        collapsed && children.length ? [...acc, id] : acc,
      []
    );

    return removeChildrenOf(
      flattenedTree,
      activeId != null ? [activeId, ...collapsedItems] : collapsedItems
    );
  }, [activeId, items]);

  const projected =
    activeId && overId
      ? getProjection(
          flattenedItems,
          activeId,
          overId,
          offsetLeft,
          indentationWidth,
          maxDepth
        )
      : null;

  const sensorContext: SensorContext = useRef({
    items: flattenedItems,
    offset: offsetLeft,
  });

  const [coordinateGetter] = useState(() =>
    sortableTreeKeyboardCoordinates(sensorContext, indicator, indentationWidth)
  );

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 8 },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter,
    })
  );

  const sortedIds = useMemo(
    () => flattenedItems.map(({ id }) => id),
    [flattenedItems]
  );

  const activeItem = activeId
    ? flattenedItems.find(({ id }) => id === activeId)
    : null;

  useEffect(() => {
    sensorContext.current = {
      items: flattenedItems,
      offset: offsetLeft,
    };
  }, [flattenedItems, offsetLeft]);

  /**
   * Execute the pending move after user confirms via dialog.
   */
  const executePendingMove = useCallback(() => {
    if (!pendingMove) return;

    const { activeId, overId, depth, parentId, clonedItems } = pendingMove;
    const overIndex = clonedItems.findIndex(({ id }) => id === overId);
    const activeIndex = clonedItems.findIndex(({ id }) => id === activeId);
    const activeTreeItem = clonedItems[activeIndex];

    clonedItems[activeIndex] = { ...activeTreeItem, depth, parentId };

    const sortedItems = arrayMove(clonedItems, activeIndex, overIndex);
    const newItems = buildTree(sortedItems);

    setItems(newItems);
    onItemsChange?.(newItems);
    setPendingMove(null);
    setShowReparentWarning(false);
  }, [pendingMove, onItemsChange]);

  /**
   * Cancel the pending move.
   */
  const cancelPendingMove = useCallback(() => {
    setPendingMove(null);
    setShowReparentWarning(false);
  }, []);

  const announcements: Announcements = {
    onDragStart({ active }) {
      return `Picked up ${active.id}.`;
    },
    onDragMove({ active, over }) {
      return getMovementAnnouncement("onDragMove", active.id, over?.id);
    },
    onDragOver({ active, over }) {
      return getMovementAnnouncement("onDragOver", active.id, over?.id);
    },
    onDragEnd({ active, over }) {
      return getMovementAnnouncement("onDragEnd", active.id, over?.id);
    },
    onDragCancel({ active }) {
      return `Moving was cancelled. ${active.id} was dropped in its original position.`;
    },
  };

  return (
    <DndContext
      accessibility={{ announcements }}
      sensors={sensors}
      collisionDetection={closestCenter}
      measuring={measuring}
      onDragStart={handleDragStart}
      onDragMove={handleDragMove}
      onDragOver={handleDragOver}
      onDragEnd={handleDragEnd}
      onDragCancel={handleDragCancel}
    >
      <SortableContext
        items={sortedIds}
        strategy={verticalListSortingStrategy}
        disabled={!isEditing}
      >
        <ul className="space-y-1">
          {flattenedItems.map(
            ({
              id,
              name,
              description,
              children,
              collapsed,
              depth,
              pinnedOrder,
              tmdbPosterPath,
              artworkId,
              driveFileId,
              fileCounts,
              childCount,
              mediaIconType,
              progressPercentage,
              watchedCount,
              totalMediaCount,
              totalItems,
            }) => (
              <SortableTreeItem
                key={id}
                id={id}
                value={name}
                description={description}
                depth={id === activeId && projected ? projected.depth : depth}
                indentationWidth={indentationWidth}
                indicator={indicator}
                collapsed={Boolean(collapsed && children.length)}
                isPinned={pinnedOrder != null}
                onCollapse={
                  collapsible && children.length
                    ? () => handleCollapse(id)
                    : undefined
                }
                onClick={() => onItemClick?.(id)}
                onSettings={
                  onOpenSettings ? () => onOpenSettings(String(id)) : undefined
                }
                onDelete={
                  onDeleteItem ? () => onDeleteItem(String(id)) : undefined
                }
                onAddChild={
                  onAddChild
                    ? (childName, childDescription) =>
                        onAddChild(String(id), childName, childDescription)
                    : undefined
                }
                onAddChildComplete={onAddChildComplete}
                tmdbPosterPath={tmdbPosterPath}
                artworkId={artworkId}
                driveFileId={driveFileId}
                fileCounts={fileCounts}
                childCount={childCount}
                mediaIconType={mediaIconType}
                progressPercentage={progressPercentage}
                watchedCount={watchedCount}
                totalMediaCount={totalMediaCount}
                totalItems={totalItems}
                hasDriveConnection={hasDriveConnection}
                onPin={onPinItem ? () => onPinItem(String(id)) : undefined}
                onUnpin={
                  onUnpinItem ? () => onUnpinItem(String(id)) : undefined
                }
                isSelected={isItemSelected?.(String(id))}
                onSelectChange={
                  onItemSelectChange
                    ? (selected) => onItemSelectChange(String(id), selected)
                    : undefined
                }
                isEditing={isEditing}
              />
            )
          )}
        </ul>
        {typeof document !== "undefined" &&
          createPortal(
            <DragOverlay dropAnimation={dropAnimationConfig}>
              {activeId && activeItem ? (
                <TreeItem
                  id={activeId}
                  depth={activeItem.depth}
                  clone
                  childCount={getChildCount(items, activeId) + 1}
                  value={activeItem.name}
                  indentationWidth={indentationWidth}
                />
              ) : null}
            </DragOverlay>,
            document.body
          )}
      </SortableContext>

      {/* Reparent warning dialog for inheriting items */}
      <ReparentWarningDialog
        open={showReparentWarning}
        onOpenChange={(open) => {
          if (!open) cancelPendingMove();
        }}
        itemName={pendingMove?.itemName ?? ""}
        oldParentName={pendingMove?.oldParentName ?? null}
        newParentName={pendingMove?.newParentName ?? null}
        willBecomePublic={pendingMove?.willBecomePublic ?? false}
        willBecomePrivate={pendingMove?.willBecomePrivate ?? false}
        onConfirm={executePendingMove}
      />
    </DndContext>
  );

  function handleDragStart({ active: { id: activeId } }: DragStartEvent) {
    setActiveId(activeId);
    setOverId(activeId);

    const activeItem = flattenedItems.find(({ id }) => id === activeId);

    if (activeItem) {
      setCurrentPosition({
        parentId: activeItem.parentId,
        overId: activeId,
      });
    }

    document.body.style.setProperty("cursor", "grabbing");
  }

  function handleDragMove({ delta }: DragMoveEvent) {
    setOffsetLeft(delta.x);
  }

  function handleDragOver({ over }: DragOverEvent) {
    setOverId(over?.id ?? null);
  }

  function handleDragEnd({ active, over }: DragEndEvent) {
    resetState();

    if (projected && over) {
      const { depth, parentId } = projected;
      const clonedItems: FlattenedItem[] = JSON.parse(
        JSON.stringify(flattenTree(items))
      );
      const overIndex = clonedItems.findIndex(({ id }) => id === over.id);
      const activeIndex = clonedItems.findIndex(({ id }) => id === active.id);
      const activeTreeItem = clonedItems[activeIndex];

      // Check if an inheriting item is being reparented
      const isReparenting = activeTreeItem.parentId !== parentId;
      const inheritsVisibility = activeTreeItem.inheritVisibility === true;

      if (isReparenting && inheritsVisibility) {
        // Find parent names for the warning dialog
        const oldParent = clonedItems.find(
          (i) => i.id === activeTreeItem.parentId
        );
        const newParent = clonedItems.find((i) => i.id === parentId);

        // Determine visibility change direction based on parent visibility
        // If we can't determine, show generic warning
        const oldParentIsPublic = oldParent?.isPublic ?? false;
        const newParentIsPublic = newParent?.isPublic ?? false;
        const willBecomePublic = !oldParentIsPublic && newParentIsPublic;
        const willBecomePrivate = oldParentIsPublic && !newParentIsPublic;

        // Store pending move and show warning dialog
        setPendingMove({
          activeId: active.id,
          overId: over.id,
          depth,
          parentId,
          itemName: activeTreeItem.name,
          oldParentName: oldParent?.name ?? null,
          newParentName: newParent?.name ?? null,
          willBecomePublic,
          willBecomePrivate,
          clonedItems,
        });
        setShowReparentWarning(true);
        return;
      }

      // Proceed with move
      clonedItems[activeIndex] = { ...activeTreeItem, depth, parentId };

      const sortedItems = arrayMove(clonedItems, activeIndex, overIndex);
      const newItems = buildTree(sortedItems);

      setItems(newItems);
      onItemsChange?.(newItems);
    }
  }

  function handleDragCancel() {
    resetState();
  }

  function resetState() {
    setOverId(null);
    setActiveId(null);
    setOffsetLeft(0);
    setCurrentPosition(null);

    document.body.style.setProperty("cursor", "");
  }

  function handleCollapse(id: UniqueIdentifier) {
    setItems((items) => setProperty(items, id, "collapsed", (value) => !value));
  }

  function getMovementAnnouncement(
    eventName: string,
    activeId: UniqueIdentifier,
    overId?: UniqueIdentifier
  ) {
    if (overId && projected) {
      if (eventName !== "onDragEnd") {
        if (
          currentPosition &&
          projected.parentId === currentPosition.parentId &&
          overId === currentPosition.overId
        ) {
          return;
        } else {
          setCurrentPosition({
            parentId: projected.parentId,
            overId,
          });
        }
      }

      const clonedItems: FlattenedItem[] = JSON.parse(
        JSON.stringify(flattenTree(items))
      );
      const overIndex = clonedItems.findIndex(({ id }) => id === overId);
      const activeIndex = clonedItems.findIndex(({ id }) => id === activeId);
      const sortedItems = arrayMove(clonedItems, activeIndex, overIndex);

      const previousItem = sortedItems[overIndex - 1];

      let announcement;
      const movedVerb = eventName === "onDragEnd" ? "dropped" : "moved";
      const nestedVerb = eventName === "onDragEnd" ? "dropped" : "nested";

      if (!previousItem) {
        const nextItem = sortedItems[overIndex + 1];
        announcement = `${activeId} was ${movedVerb} before ${nextItem?.id ?? "the end"}.`;
      } else {
        if (projected.depth > previousItem.depth) {
          announcement = `${activeId} was ${nestedVerb} under ${previousItem.id}.`;
        } else {
          let previousSibling: FlattenedItem | undefined = previousItem;
          while (previousSibling && projected.depth < previousSibling.depth) {
            const siblingParentId: UniqueIdentifier | null =
              previousSibling.parentId;
            previousSibling = sortedItems.find(
              ({ id }) => id === siblingParentId
            );
          }

          if (previousSibling) {
            announcement = `${activeId} was ${movedVerb} after ${previousSibling.id}.`;
          }
        }
      }

      return announcement;
    }

    return;
  }
}
