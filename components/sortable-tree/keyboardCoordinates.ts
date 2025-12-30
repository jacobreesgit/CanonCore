/**
 * Custom keyboard coordinate getter for tree navigation.
 * Handles indentation changes with left/right arrow keys.
 */

import {
  closestCorners,
  getFirstCollision,
  KeyboardCode,
  KeyboardCoordinateGetter,
  DroppableContainer,
} from "@dnd-kit/core";

import type { SensorContext } from "@/lib/types";

const directions: string[] = [
  KeyboardCode.Down,
  KeyboardCode.Right,
  KeyboardCode.Up,
  KeyboardCode.Left,
];

const horizontal: string[] = [KeyboardCode.Left, KeyboardCode.Right];

export function sortableTreeKeyboardCoordinates(
  context: SensorContext,
  indicator: boolean,
  indentationWidth: number
): KeyboardCoordinateGetter {
  return (
    event,
    {
      currentCoordinates,
      context: {
        active,
        over,
        collisionRect,
        droppableRects,
        droppableContainers,
      },
    }
  ) => {
    if (directions.includes(event.code)) {
      if (!active || !collisionRect) {
        return undefined;
      }

      event.preventDefault();

      if (horizontal.includes(event.code)) {
        const activeItem = context.current.items.find(
          ({ id }) => id === active.id
        );
        const depth = activeItem?.depth ?? 0;
        const activeIndex = context.current.items.findIndex(
          ({ id }) => id === active.id
        );
        const minDepth = context.current.items[activeIndex + 1]?.depth ?? 0;
        const previousItem = context.current.items[activeIndex - 1];
        const maxDepth = previousItem ? previousItem.depth + 1 : 0;

        if (event.code === KeyboardCode.Left && depth > minDepth) {
          const newOffset = context.current.offset - indentationWidth;
          context.current.offset = newOffset;

          return {
            ...currentCoordinates,
            x: currentCoordinates.x - indentationWidth,
          };
        }

        if (event.code === KeyboardCode.Right && depth < maxDepth) {
          const newOffset = context.current.offset + indentationWidth;
          context.current.offset = newOffset;

          return {
            ...currentCoordinates,
            x: currentCoordinates.x + indentationWidth,
          };
        }

        return undefined;
      }

      const containers: DroppableContainer[] = [];

      droppableContainers.forEach((container) => {
        if (container?.disabled || container.id === over?.id) {
          return;
        }

        const rect = droppableRects.get(container.id);

        if (!rect) {
          return;
        }

        switch (event.code) {
          case KeyboardCode.Down:
            if (rect.top > collisionRect.top) {
              containers.push(container);
            }
            break;
          case KeyboardCode.Up:
            if (rect.top < collisionRect.top) {
              containers.push(container);
            }
            break;
        }
      });

      const collisions = closestCorners({
        active,
        collisionRect,
        droppableRects,
        droppableContainers: containers,
        pointerCoordinates: null,
      });

      let closestId = getFirstCollision(collisions, "id");

      if (closestId === over?.id && collisions.length > 1) {
        closestId = collisions[1].id;
      }

      if (closestId && over?.id) {
        const activeRect = droppableRects.get(active.id);
        const newRect = droppableRects.get(closestId);
        const newDroppable = droppableContainers.get(closestId);

        if (activeRect && newRect && newDroppable) {
          const newIndex = context.current.items.findIndex(
            ({ id }) => id === closestId
          );
          const newItem = context.current.items[newIndex];
          const activeIndex = context.current.items.findIndex(
            ({ id }) => id === active.id
          );
          const activeItem = context.current.items[activeIndex];

          if (newItem && activeItem) {
            const { depth } = cycleDepth(
              activeItem.depth,
              newItem.depth,
              context.current.offset,
              indentationWidth
            );
            const offset = (depth - activeItem.depth) * indentationWidth;

            context.current.offset = offset;

            const newCoordinates = {
              x: newRect.left + offset,
              y: newRect.top,
            };

            return newCoordinates;
          }
        }
      }
    }

    return undefined;
  };
}

function cycleDepth(
  activeDepth: number,
  overDepth: number,
  offset: number,
  indentationWidth: number
) {
  const dragDepth = Math.round(offset / indentationWidth);
  const projectedDepth = activeDepth + dragDepth;

  return {
    depth: Math.max(Math.min(projectedDepth, overDepth + 1), 0),
  };
}
