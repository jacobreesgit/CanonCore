/**
 * Item detail view component with cinematic styling.
 * Displays attached files with playback controls.
 */

"use client";

import { useState, useCallback } from "react";
import {
  Play,
  Download,
  ImageIcon,
  FileText,
  Film,
  Clock,
  HardDrive,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { MediaOverlay } from "@/components/media/media-overlay";
import { updatePlaybackPosition } from "@/lib/item-file-actions";
import type { SerializedItemFile } from "@/lib/types";
import { cn } from "@/lib/utils";

interface ItemDetailProps {
  /** The item being displayed */
  item: {
    id: string;
    name: string;
  };
  /** Files attached to this item, grouped by type (serialized for client) */
  files: {
    media: SerializedItemFile[];
    artwork: SerializedItemFile[];
    subtitles: SerializedItemFile[];
  };
}

/**
 * Formats bytes to human-readable file size.
 */
function formatFileSize(bytes: number | null): string {
  if (!bytes) return "Unknown size";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024)
    return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
  return `${(bytes / 1024 / 1024 / 1024).toFixed(2)} GB`;
}

/**
 * Formats duration in seconds to time string.
 */
function formatDuration(seconds: number | null): string {
  if (!seconds) return "";
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  if (hours > 0) {
    return `${hours}h ${minutes}m`;
  }
  return `${minutes}m`;
}

/**
 * Calculates watch progress percentage.
 */
function getWatchProgress(file: SerializedItemFile): number | null {
  if (!file.playbackPosition || !file.playbackDuration) return null;
  return Math.round((file.playbackPosition / file.playbackDuration) * 100);
}

/**
 * Item detail view with cinematic styling.
 * Displays media files with playback controls and progress tracking.
 *
 * @param item - The item metadata
 * @param files - Files grouped by type
 */
export function ItemDetail({ item, files }: ItemDetailProps) {
  const [playingFile, setPlayingFile] = useState<SerializedItemFile | null>(
    null
  );

  const primaryArtwork = files.artwork[0];
  const hasContent =
    files.media.length > 0 ||
    files.artwork.length > 0 ||
    files.subtitles.length > 0;

  // Handle position update from media overlay
  const handlePositionUpdate = useCallback(
    async (fileId: string, position: number, duration: number | null) => {
      await updatePlaybackPosition(fileId, position, duration);
    },
    []
  );

  return (
    <>
      <div className="space-y-8">
        {/* Hero section with artwork */}
        <div className="relative overflow-hidden rounded-xl">
          {/* Background artwork with blur */}
          {primaryArtwork && (
            <div className="absolute inset-0 -z-10">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={`/api/stream/${primaryArtwork.id}`}
                alt=""
                className="h-full w-full scale-110 object-cover opacity-30 blur-2xl"
              />
              <div className="from-background via-background/80 to-background/40 absolute inset-0 bg-gradient-to-t" />
            </div>
          )}

          <div className="flex gap-8 p-8">
            {/* Artwork thumbnail */}
            {primaryArtwork ? (
              <div
                className={cn(
                  "relative shrink-0 overflow-hidden rounded-lg",
                  "size-48 shadow-2xl",
                  "ring-1 ring-white/10"
                )}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={`/api/stream/${primaryArtwork.id}`}
                  alt={item.name}
                  className="h-full w-full object-cover"
                />
              </div>
            ) : (
              <div
                className={cn(
                  "flex shrink-0 items-center justify-center rounded-lg",
                  "bg-muted/50 size-48",
                  "ring-1 ring-white/10"
                )}
              >
                <Film className="text-muted-foreground/50 size-16" />
              </div>
            )}

            {/* Item info */}
            <div className="flex flex-col justify-end gap-3">
              <h1 className="text-3xl font-bold tracking-tight">{item.name}</h1>
              <div className="text-muted-foreground flex items-center gap-4 text-sm">
                {files.media.length > 0 && (
                  <span className="flex items-center gap-1.5">
                    <Film className="size-4" />
                    {files.media.length} media file
                    {files.media.length !== 1 ? "s" : ""}
                  </span>
                )}
                {files.subtitles.length > 0 && (
                  <span className="flex items-center gap-1.5">
                    <FileText className="size-4" />
                    {files.subtitles.length} subtitle
                    {files.subtitles.length !== 1 ? "s" : ""}
                  </span>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Empty state */}
        {!hasContent && (
          <Card className="border-dashed">
            <CardContent className="flex flex-col items-center justify-center py-16">
              <Film className="text-muted-foreground/50 mb-4 size-12" />
              <p className="text-muted-foreground text-lg font-medium">
                No files attached
              </p>
              <p className="text-muted-foreground/70 text-sm">
                Sync this connection to discover media files
              </p>
            </CardContent>
          </Card>
        )}

        {/* Media files section */}
        {files.media.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <div className="bg-primary/10 flex size-8 items-center justify-center rounded-lg">
                  <Play className="text-primary size-4" />
                </div>
                Media Files
              </CardTitle>
              <CardDescription>
                Click to play in fullscreen, or download for offline viewing
              </CardDescription>
            </CardHeader>
            <CardContent>
              <ul className="divide-border/50 divide-y">
                {files.media.map((file) => {
                  const progress = getWatchProgress(file);

                  return (
                    <li
                      key={file.id}
                      className={cn(
                        "group relative flex items-center justify-between gap-4 py-4",
                        "hover:bg-muted/50 transition-colors",
                        "-mx-6 px-6 first:-mt-2 last:-mb-2"
                      )}
                    >
                      {/* Progress bar background */}
                      {progress !== null && progress > 0 && (
                        <div
                          className="bg-primary/5 absolute inset-y-0 left-0 transition-all"
                          style={{ width: `${progress}%` }}
                        />
                      )}

                      <div className="relative z-10 min-w-0 flex-1">
                        <p className="truncate font-medium">{file.filename}</p>
                        <div className="text-muted-foreground mt-1 flex flex-wrap items-center gap-3 text-sm">
                          <span className="flex items-center gap-1">
                            <HardDrive className="size-3.5" />
                            {formatFileSize(file.size)}
                          </span>
                          {file.playbackDuration && (
                            <span className="flex items-center gap-1">
                              <Clock className="size-3.5" />
                              {formatDuration(file.playbackDuration)}
                            </span>
                          )}
                          {progress !== null && progress > 0 && (
                            <span
                              className={cn(
                                "rounded-full px-2 py-0.5 text-xs font-medium",
                                progress === 100
                                  ? "bg-green-500/10 text-green-500"
                                  : "bg-primary/10 text-primary"
                              )}
                            >
                              {progress}% watched
                            </span>
                          )}
                        </div>
                      </div>

                      <div className="relative z-10 flex items-center gap-2">
                        <Button
                          variant="default"
                          size="sm"
                          onClick={() => setPlayingFile(file)}
                          className="gap-1.5"
                        >
                          <Play className="size-4" />
                          {progress !== null && progress > 0 && progress < 100
                            ? "Resume"
                            : "Play"}
                        </Button>
                        <Button variant="ghost" size="icon" asChild>
                          <a
                            href={`/api/sftp/download/file/${file.id}`}
                            download={file.filename}
                            title="Download"
                          >
                            <Download className="size-4" />
                          </a>
                        </Button>
                      </div>
                    </li>
                  );
                })}
              </ul>
            </CardContent>
          </Card>
        )}

        {/* Artwork gallery section */}
        {files.artwork.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <div className="bg-primary/10 flex size-8 items-center justify-center rounded-lg">
                  <ImageIcon className="text-primary size-4" />
                </div>
                Artwork
              </CardTitle>
              <CardDescription>
                {files.artwork.length} image
                {files.artwork.length !== 1 ? "s" : ""} attached
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4">
                {files.artwork.map((file) => (
                  <div
                    key={file.id}
                    className={cn(
                      "group relative aspect-square overflow-hidden rounded-lg",
                      "bg-muted ring-border/50 ring-1",
                      "hover:ring-primary/50 transition-all hover:shadow-lg"
                    )}
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={`/api/stream/${file.id}`}
                      alt={file.filename}
                      className="h-full w-full object-cover transition-transform group-hover:scale-105"
                    />
                    <div
                      className={cn(
                        "absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/80 to-transparent",
                        "p-3 opacity-0 transition-opacity group-hover:opacity-100"
                      )}
                    >
                      <p className="truncate text-xs text-white">
                        {file.filename}
                      </p>
                    </div>
                    <Button
                      variant="ghost"
                      size="icon"
                      className={cn(
                        "absolute top-2 right-2 size-8",
                        "bg-black/50 text-white opacity-0 backdrop-blur-sm",
                        "transition-opacity group-hover:opacity-100",
                        "hover:bg-black/70"
                      )}
                      asChild
                    >
                      <a
                        href={`/api/sftp/download/file/${file.id}`}
                        download={file.filename}
                        title="Download"
                      >
                        <Download className="size-4" />
                      </a>
                    </Button>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Subtitles section */}
        {files.subtitles.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <div className="bg-primary/10 flex size-8 items-center justify-center rounded-lg">
                  <FileText className="text-primary size-4" />
                </div>
                Subtitles
              </CardTitle>
              <CardDescription>
                Available subtitle tracks for media playback
              </CardDescription>
            </CardHeader>
            <CardContent>
              <ul className="space-y-2">
                {files.subtitles.map((file) => (
                  <li
                    key={file.id}
                    className={cn(
                      "flex items-center justify-between rounded-lg p-3",
                      "bg-muted/30 hover:bg-muted/50 transition-colors"
                    )}
                  >
                    <div className="flex items-center gap-3">
                      <FileText className="text-muted-foreground size-4" />
                      <span className="text-sm font-medium">
                        {file.filename}
                      </span>
                    </div>
                    <Button variant="ghost" size="sm" asChild>
                      <a
                        href={`/api/sftp/download/file/${file.id}`}
                        download={file.filename}
                        className="gap-1.5"
                      >
                        <Download className="size-4" />
                        Download
                      </a>
                    </Button>
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Media player overlay */}
      {playingFile && (
        <MediaOverlay
          file={playingFile}
          subtitles={files.subtitles}
          onClose={() => setPlayingFile(null)}
          onPositionUpdate={handlePositionUpdate}
        />
      )}
    </>
  );
}
