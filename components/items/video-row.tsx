/**
 * Video/trailer row with YouTube thumbnails.
 * Clicking opens video in modal (placeholder for now).
 */

"use client";

import Image from "next/image";
import { Play } from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import type { Video } from "@/lib/tmdb-client";

interface VideoRowProps {
  /** Videos from TMDB or mock data. */
  videos: Video[];
  /** Section title. */
  title?: string;
  /** Additional CSS classes. */
  className?: string;
}

/**
 * Displays YouTube video thumbnails from TMDB.
 * Clicking shows toast (video modal coming in full implementation).
 */
export function VideoRow({
  videos,
  title = "Trailers & Videos",
  className,
}: VideoRowProps) {
  if (videos.length === 0) return null;

  const handleVideoClick = (video: Video) => {
    // In full implementation, this would open a modal with YouTube embed
    toast.info(`Opening "${video.name}"`, {
      description: "Video player modal coming in full implementation.",
      action: {
        label: "Watch on YouTube",
        onClick: () =>
          window.open(`https://www.youtube.com/watch?v=${video.key}`, "_blank"),
      },
    });
  };

  return (
    <section className={className} data-testid="about-videos-section">
      <h2
        className={cn(
          "mb-4 text-xs font-medium tracking-[0.2em] uppercase",
          "text-[var(--tertiary-foreground)]"
        )}
      >
        {title}
      </h2>

      {/* Scrollable row */}
      <div
        className={cn(
          "flex gap-4 overflow-x-auto pb-2",
          "scrollbar-thin scrollbar-track-transparent scrollbar-thumb-white/10",
          "snap-x snap-mandatory"
        )}
      >
        {videos.map((video) => (
          <button
            key={video.id}
            onClick={() => handleVideoClick(video)}
            className={cn(
              "group relative flex-shrink-0 snap-start",
              "w-64 overflow-hidden rounded-lg",
              "bg-card",
              "focus-visible:ring-2 focus-visible:ring-white focus-visible:outline-none"
            )}
          >
            {/* YouTube thumbnail */}
            <div className="relative aspect-video">
              <Image
                src={`https://img.youtube.com/vi/${video.key}/mqdefault.jpg`}
                alt={video.name}
                fill
                sizes="256px"
                className={cn(
                  "object-cover",
                  "transition-transform duration-300",
                  "group-hover:scale-105"
                )}
              />

              {/* Play button overlay */}
              <div
                className={cn(
                  "absolute inset-0 flex items-center justify-center",
                  "bg-black/30",
                  "transition-colors duration-200",
                  "group-hover:bg-black/50"
                )}
              >
                <div
                  className={cn(
                    "flex size-12 items-center justify-center rounded-full",
                    "bg-white/20 backdrop-blur-sm",
                    "transition-transform duration-200",
                    "group-hover:scale-110"
                  )}
                >
                  <Play className="size-6 fill-white text-white" />
                </div>
              </div>
            </div>

            {/* Video info */}
            <div className="p-3">
              <p
                className={cn(
                  "truncate text-sm font-medium",
                  "text-foreground"
                )}
              >
                {video.name}
              </p>
              <p className="text-xs text-[var(--tertiary-foreground)]">
                {video.type}
              </p>
            </div>
          </button>
        ))}
      </div>
    </section>
  );
}

export default VideoRow;
