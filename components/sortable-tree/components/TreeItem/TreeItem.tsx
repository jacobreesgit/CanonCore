/**
 * Base tree item component with drag handle, collapse toggle, and actions.
 * Features refined micro-interactions and subtle visual feedback.
 */

"use client";

import React, { forwardRef, HTMLAttributes, useState } from "react";
import type { UniqueIdentifier } from "@dnd-kit/core";
import { cn } from "@/lib/utils";
import {
  ChevronRight,
  Folder,
  FolderOpen,
  GripVertical,
  Server,
  Trash2,
} from "lucide-react";

export interface TreeItemProps extends Omit<
  HTMLAttributes<HTMLLIElement>,
  "id"
> {
  id: UniqueIdentifier;
  value: string;
  /** Optional short description (max 200 chars). */
  description?: string | null;
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
  /** SFTP path if linked to remote server. */
  sftpPath?: string | null;
  /** Artwork file ID for thumbnail display. */
  artworkId?: string | null;
  /** Whether to show artwork thumbnail. Defaults to true. */
  showArtwork?: boolean;
  /** Whether to show the drag handle. Defaults to true. */
  showDragHandle?: boolean;
  /** Whether to show description. Defaults to true. Hidden in edit mode. */
  showDescription?: boolean;
  /** Connection name for badge display. */
  connectionName?: string | null;
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
      artworkId,
      showArtwork = true,
      showDragHandle = true,
      description,
      showDescription = true,
      connectionName,
      sftpPath: _sftpPath, // eslint-disable-line @typescript-eslint/no-unused-vars
      ...props
    },
    ref
  ) {
    const [imageError, setImageError] = useState(false);
    const hasChildren = Boolean(onCollapse);
    const shouldShowArtwork = showArtwork && artworkId && !imageError;
    const shouldShowDescription = showDescription && description;

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
            "group bg-card relative flex items-center gap-2 rounded-lg border px-2 py-1.5",
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
          {!ghost && showDragHandle && (
            <button
              type="button"
              aria-label="Drag handle"
              className={cn(
                "flex-shrink-0 touch-none rounded",
                "flex size-5 items-center justify-center",
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
              aria-label={collapsed ? "Expand item" : "Collapse item"}
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

          {/* Item Icon - Show artwork thumbnail or folder icon (only in view mode) */}
          {!ghost && showArtwork && (
            <span className="flex-shrink-0">
              {shouldShowArtwork ? (
                <div className="size-5 overflow-hidden rounded">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={`/api/artwork/${artworkId}`}
                    alt=""
                    className="size-full object-cover"
                    onError={() => setImageError(true)}
                  />
                </div>
              ) : hasChildren && !collapsed ? (
                <FolderOpen
                  className="text-muted-foreground/70 size-4"
                  strokeWidth={1.75}
                />
              ) : (
                <Folder
                  className="text-muted-foreground/70 size-4"
                  strokeWidth={1.75}
                />
              )}
            </span>
          )}

          {/* Item Name and Description */}
          {!ghost && (
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-1.5">
                <span
                  className={cn(
                    "truncate text-sm font-medium",
                    "text-foreground/90 group-hover:text-foreground",
                    "transition-colors duration-150"
                  )}
                >
                  {value}
                </span>
                {connectionName && (
                  <span
                    className={cn(
                      "inline-flex flex-shrink-0 items-center gap-0.5 rounded-full px-1.5 py-0.5",
                      "bg-primary/10 text-primary text-[10px] font-medium"
                    )}
                  >
                    <Server className="size-2.5" />
                    {connectionName}
                  </span>
                )}
              </div>
              {/* Description line - always reserve space to prevent layout shift */}
              <span
                className={cn(
                  "block min-h-4 truncate text-xs",
                  "transition-colors duration-150",
                  shouldShowDescription ? "text-muted-foreground" : "invisible"
                )}
                aria-hidden={!shouldShowDescription}
              >
                {description || "\u00A0"}
              </span>
            </div>
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
