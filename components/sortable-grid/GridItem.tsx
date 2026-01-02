/**
 * Grid item card component for sortable grid view.
 * Displays folder or file with refined hover states and smooth transitions.
 * Supports SFTP file display with sync status and download.
 */

"use client";

import React, { forwardRef, HTMLAttributes } from "react";
import type { UniqueIdentifier } from "@dnd-kit/core";
import { cn } from "@/lib/utils";
import { File, Folder } from "lucide-react";
import type { ItemType, SyncStatus } from "@/lib/types";
import { SyncStatusBadge } from "@/components/sftp/sync-status-badge";
import { DownloadButton } from "@/components/sftp/download-button";

export interface GridItemProps extends Omit<
  HTMLAttributes<HTMLDivElement>,
  "id"
> {
  id: UniqueIdentifier;
  name: string;
  isDragging?: boolean;
  isOverlay?: boolean;
  handleProps?: Record<string, unknown>;
  onClick?(): void;
  /** SFTP item type (FILE or FOLDER). */
  itemType?: ItemType;
  /** SFTP path if linked to remote server. */
  sftpPath?: string | null;
  /** Current sync status for SFTP items. */
  syncStatus?: SyncStatus;
}

export const GridItem = forwardRef<HTMLDivElement, GridItemProps>(
  function GridItem(
    {
      id,
      name,
      isDragging,
      isOverlay,
      handleProps,
      onClick,
      className,
      style,
      itemType,
      sftpPath,
      syncStatus,
      ...props
    },
    ref
  ) {
    const isFile = itemType === "FILE";
    const isSftpItem = Boolean(sftpPath);

    return (
      <div
        ref={ref}
        data-id={String(id)}
        onClick={onClick}
        className={cn(
          "group relative flex cursor-pointer flex-col items-center justify-center gap-3",
          "bg-card rounded-xl border p-5",
          "transition-all duration-200 ease-out",
          "hover:bg-accent/40 hover:border-accent-foreground/20 hover:shadow-md",
          "focus-visible:ring-ring focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none",
          isDragging && "scale-[0.98] opacity-40",
          isOverlay && [
            "ring-primary/50 shadow-2xl ring-2 shadow-black/25",
            "bg-card/95 backdrop-blur-sm",
            "scale-[1.03]",
            "border-primary/30",
          ],
          className
        )}
        style={style}
        {...handleProps}
        {...props}
      >
        {/* Item Icon with subtle gradient effect */}
        <div
          className={cn(
            "relative flex items-center justify-center",
            "size-14 rounded-lg",
            "from-muted/80 to-muted bg-gradient-to-br",
            "transition-all duration-200",
            "group-hover:from-primary/10 group-hover:to-primary/5",
            "group-hover:shadow-sm"
          )}
        >
          {isFile ? (
            <File
              className={cn(
                "size-8 transition-colors duration-200",
                "text-muted-foreground/70",
                "group-hover:text-primary/80"
              )}
              strokeWidth={1.5}
            />
          ) : (
            <Folder
              className={cn(
                "size-8 transition-colors duration-200",
                "text-muted-foreground/70",
                "group-hover:text-primary/80"
              )}
              strokeWidth={1.5}
            />
          )}
        </div>

        {/* Item Name */}
        <span
          className={cn(
            "w-full truncate px-1 text-center text-sm font-medium",
            "text-foreground/85 transition-colors duration-150",
            "group-hover:text-foreground"
          )}
        >
          {name}
        </span>

        {/* SFTP Sync Status Badge - positioned at top right */}
        {isSftpItem && syncStatus && !isOverlay && (
          <div className="absolute top-2 right-2 opacity-0 transition-opacity group-hover:opacity-100">
            <SyncStatusBadge
              status={syncStatus}
              showLabel={false}
              className="px-1.5 py-0.5"
            />
          </div>
        )}

        {/* SFTP Download Button - for files, positioned at bottom right */}
        {isFile && isSftpItem && !isOverlay && (
          <div className="absolute right-2 bottom-2 opacity-0 transition-opacity group-hover:opacity-100">
            <DownloadButton
              itemId={String(id)}
              fileName={name}
              size="icon"
              className="size-7"
            />
          </div>
        )}

        {/* Subtle drag indicator on hover */}
        <div
          className={cn(
            "absolute inset-x-0 top-0 h-1 rounded-t-xl",
            "via-primary/0 bg-gradient-to-r from-transparent to-transparent",
            "transition-all duration-200",
            "group-hover:via-primary/30"
          )}
        />
      </div>
    );
  }
);
