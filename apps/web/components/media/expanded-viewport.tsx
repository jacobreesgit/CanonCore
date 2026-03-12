/**
 * Expanded viewport content for the unified player.
 * For video: provides the layout container (the single MediaProvider
 * is CSS-repositioned here by MediaPlayerInner — NOT mounted here).
 * For audio: renders artwork backdrop or MeshGradient.
 * No overlay controls — the mini bar owns all controls.
 */

"use client";

import { memo } from "react";
import { MeshGradient } from "@mesh-gradient/react";
import type { QueueTrack } from "@/lib/store/types";

interface ExpandedViewportProps {
  currentTrack: QueueTrack;
  isVideoFile: boolean;
}

export const ExpandedViewport = memo(function ExpandedViewport({
  currentTrack,
  isVideoFile,
}: ExpandedViewportProps) {
  // Video: the MediaProvider is already visible via CSS repositioning in MediaPlayerInner.
  // This container just provides the centering layout.
  if (isVideoFile) {
    return (
      <div className="flex h-full w-full items-center justify-center">
        {/* MediaProvider video element is visible here via CSS "contents" on its wrapper */}
      </div>
    );
  }

  // Audio with artwork — poster image with blurred backdrop
  if (currentTrack.posterUrl) {
    return (
      <div className="relative flex h-full w-full items-center justify-center overflow-hidden">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={currentTrack.posterUrl}
          alt=""
          aria-hidden="true"
          className="absolute inset-0 h-full w-full scale-110 object-cover blur-3xl brightness-50 will-change-transform"
        />
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={currentTrack.posterUrl}
          alt={`${currentTrack.itemName} artwork`}
          className="relative z-10 max-h-[60%] max-w-[80%] rounded-lg object-contain shadow-2xl"
        />
      </div>
    );
  }

  // Audio without artwork — animated mesh gradient
  return (
    <MeshGradient
      className="h-full w-full"
      options={{
        colors: ["#0d0d0d", "#1a0a1e", "#0a1628", "#1e1e2e"],
        animationSpeed: 0.15,
        seed: 19,
      }}
    />
  );
});
