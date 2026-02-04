/**
 * Client component for item page hero action buttons.
 * Handles fork dialog state and shows fork count badge.
 */

"use client";

import { useState } from "react";
import { Play, Share2, Users } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  DemoHeroButton,
  DemoPlaylistButton,
  DemoForkDialog,
} from "../components";

interface ItemHeroActionsProps {
  movieTitle: string;
}

/** Mock fork count for demo. */
const MOCK_FORK_COUNT = 127;

/**
 * Hero action buttons with fork dialog integration and fork count badge.
 */
export function ItemHeroActions({ movieTitle }: ItemHeroActionsProps) {
  const [forkDialogOpen, setForkDialogOpen] = useState(false);

  return (
    <>
      <DemoHeroButton variant="primary">
        <Play className="size-4 fill-current" aria-hidden="true" />
        <span>Play</span>
      </DemoHeroButton>
      <DemoPlaylistButton />

      {/* Fork button with badge */}
      <div className="relative">
        <DemoHeroButton onClick={() => setForkDialogOpen(true)}>
          <Share2 className="size-4" aria-hidden="true" />
          <span>Fork</span>
        </DemoHeroButton>

        {/* Fork count badge */}
        <div
          className={cn(
            "absolute -top-3 -right-4",
            "flex items-center gap-1 rounded-full px-2 py-0.5",
            "bg-white/20 backdrop-blur-sm",
            "text-xs font-medium text-white",
            "border border-white/30"
          )}
        >
          <Users className="size-3" aria-hidden="true" />
          <span>{MOCK_FORK_COUNT}</span>
        </div>
      </div>

      <DemoForkDialog
        open={forkDialogOpen}
        onOpenChange={setForkDialogOpen}
        itemName={movieTitle}
      />
    </>
  );
}
