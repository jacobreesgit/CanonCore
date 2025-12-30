/**
 * Base tree item component with drag handle, collapse toggle, and actions.
 * Features refined micro-interactions and subtle visual feedback.
 */

"use client";

import React, { forwardRef, HTMLAttributes } from "react";
import type { UniqueIdentifier } from "@dnd-kit/core";
import { cn } from "@/lib/utils";
import {
  ChevronRight,
  Folder,
  FolderOpen,
  GripVertical,
  Trash2,
} from "lucide-react";

export interface TreeItemProps extends Omit<
  HTMLAttributes<HTMLLIElement>,
  "id"
> {
  id: UniqueIdentifier;
  value: string;
  depth: number;
  indentationWidth: number;
  collapsed?: boolean;
  clone?: boolean;
  childCount?: number;
  indicator?: boolean;
  ghost?: boolean;
  disableSelection?: boolean;
  disableInteraction?: boolean;
  handleProps?: Record<string, unknown>;
  wrapperRef?(node: HTMLLIElement): void;
  onCollapse?(): void;
  onRemove?(): void;
  onClick?(): void;
}

export const TreeItem = forwardRef<HTMLDivElement, TreeItemProps>(
  function TreeItem(
    {
      id,
      value,
      depth,
      indentationWidth,
      collapsed,
      clone,
      childCount,
      indicator,
      ghost,
      disableSelection,
      disableInteraction,
      handleProps,
      wrapperRef,
      onCollapse,
      onRemove,
      onClick,
      style,
      className,
      ...props
    },
    ref
  ) {
    const hasChildren = Boolean(onCollapse);

    return (
      <li
        ref={wrapperRef}
        data-id={String(id)}
        className={cn(
          "list-none",
          clone && "pointer-events-none inline-block pt-1",
          ghost && !clone && "opacity-40",
          disableSelection && "select-none",
          disableInteraction && "pointer-events-none",
          className
        )}
        style={{
          paddingLeft: clone ? 10 : `${depth * indentationWidth}px`,
          ...style,
        }}
        {...props}
      >
        <div
          ref={ref}
          onClick={onClick}
          className={cn(
            "group bg-card relative flex items-center gap-1.5 rounded-lg border px-2 py-1.5",
            "transition-all duration-200 ease-out",
            "hover:bg-accent/50 hover:border-accent-foreground/20",
            "focus-visible:ring-ring focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none",
            clone && [
              "ring-primary/50 shadow-xl ring-2 shadow-black/20",
              "bg-card/95 backdrop-blur-sm",
              "scale-[1.02]",
            ],
            ghost &&
              indicator && [
                "border-primary bg-primary/20 h-1.5 px-0 py-0",
                "before:absolute before:top-1/2 before:-left-1.5 before:-translate-y-1/2",
                "before:border-primary before:bg-background before:size-2.5 before:rounded-full before:border-2",
              ],
            onClick && "cursor-pointer"
          )}
        >
          {/* Drag Handle */}
          {!ghost && (
            <button
              type="button"
              className={cn(
                "flex-shrink-0 touch-none rounded p-0.5",
                "text-muted-foreground/50 transition-colors duration-150",
                "hover:text-muted-foreground hover:bg-muted/50",
                "focus-visible:ring-ring focus-visible:ring-1 focus-visible:outline-none",
                "cursor-grab active:cursor-grabbing"
              )}
              {...handleProps}
            >
              <GripVertical className="size-3.5" strokeWidth={2.5} />
            </button>
          )}

          {/* Collapse Toggle */}
          {!ghost && onCollapse && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onCollapse();
              }}
              className={cn(
                "flex-shrink-0 rounded p-0.5",
                "text-muted-foreground transition-all duration-200",
                "hover:text-foreground hover:bg-muted/50",
                "focus-visible:ring-ring focus-visible:ring-1 focus-visible:outline-none"
              )}
            >
              <ChevronRight
                className={cn(
                  "size-3.5 transition-transform duration-200 ease-out",
                  !collapsed && "rotate-90"
                )}
                strokeWidth={2.5}
              />
            </button>
          )}

          {/* Folder Icon */}
          {!ghost && (
            <span className="text-muted-foreground/70 flex-shrink-0">
              {hasChildren && !collapsed ? (
                <FolderOpen className="size-4" strokeWidth={1.75} />
              ) : (
                <Folder className="size-4" strokeWidth={1.75} />
              )}
            </span>
          )}

          {/* Item Name */}
          {!ghost && (
            <span
              className={cn(
                "flex-1 truncate text-sm font-medium",
                "text-foreground/90 group-hover:text-foreground",
                "transition-colors duration-150"
              )}
            >
              {value}
            </span>
          )}

          {/* Child Count Badge (for clone/drag overlay) */}
          {clone && childCount && childCount > 1 && (
            <span
              className={cn(
                "absolute -top-2 -right-2 z-10",
                "flex items-center justify-center",
                "size-5 rounded-full",
                "bg-primary text-primary-foreground",
                "text-xs font-semibold",
                "shadow-primary/30 shadow-md",
                "ring-background ring-2"
              )}
            >
              {childCount}
            </span>
          )}

          {/* Remove Button */}
          {!ghost && onRemove && !clone && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onRemove();
              }}
              className={cn(
                "flex-shrink-0 rounded p-1",
                "text-muted-foreground/0 transition-all duration-150",
                "group-hover:text-muted-foreground hover:!text-destructive hover:bg-destructive/10",
                "focus-visible:ring-destructive focus-visible:ring-1 focus-visible:outline-none",
                "opacity-0 group-hover:opacity-100"
              )}
            >
              <Trash2 className="size-3.5" strokeWidth={2} />
            </button>
          )}
        </div>
      </li>
    );
  }
);
