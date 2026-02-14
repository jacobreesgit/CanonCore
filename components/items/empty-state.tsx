/**
 * Contextual empty state component for items views.
 * Displays different messages and actions based on the current context.
 */

"use client";

import { Folder, FolderOpen, FilterX, Plus, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export type EmptyStateVariant =
  | "first-time"
  | "no-children"
  | "filter-empty"
  | "public-profile-empty"
  | "public-item-empty"
  | "explore-empty";

interface EmptyStateConfig {
  icon: React.ComponentType<{ className?: string; strokeWidth?: number }>;
  title: string;
  description: string;
  actionLabel: string;
  actionIcon: React.ComponentType<{ className?: string }>;
}

const EMPTY_STATE_CONFIG: Record<EmptyStateVariant, EmptyStateConfig> = {
  "first-time": {
    icon: Folder,
    title: "No items yet",
    description:
      "Create your first item to start organizing your media library.",
    actionLabel: "Add Item",
    actionIcon: Plus,
  },
  "no-children": {
    icon: FolderOpen,
    title: "No child items",
    description: "Add child items to organize content within this folder.",
    actionLabel: "Add Child",
    actionIcon: Plus,
  },
  "filter-empty": {
    icon: FilterX,
    title: "No matching items",
    description:
      "No items match your current filter. Try adjusting your filter criteria.",
    actionLabel: "Clear Filter",
    actionIcon: X,
  },
  "public-profile-empty": {
    icon: Folder,
    title: "No public items yet",
    description:
      "This user hasn't shared any items publicly. Check back later!",
    actionLabel: "",
    actionIcon: Folder,
  },
  "public-item-empty": {
    icon: FolderOpen,
    title: "No child items",
    description: "This item doesn't have any children.",
    actionLabel: "",
    actionIcon: FolderOpen,
  },
  "explore-empty": {
    icon: Folder,
    title: "Nothing here yet",
    description:
      "Be the first to share your items! Make your profile public to have your items featured here.",
    actionLabel: "",
    actionIcon: Folder,
  },
};

interface EmptyStateProps {
  /** The variant of empty state to display */
  variant: EmptyStateVariant;
  /** Optional callback for the action button */
  onAction?: () => void;
  /** Optional custom class name */
  className?: string;
}

/**
 * Displays a contextual empty state based on the current view context.
 *
 * @param variant - The type of empty state to show
 * @param onAction - Callback when the action button is clicked
 * @param className - Additional CSS classes
 *
 * @example
 * // First-time user with no items
 * <EmptyState variant="first-time" onAction={() => setAddItemOpen(true)} />
 *
 * @example
 * // Filter yielded no results
 * <EmptyState variant="filter-empty" onAction={() => setFilterBy("all")} />
 */
export function EmptyState({ variant, onAction, className }: EmptyStateProps) {
  const config = EMPTY_STATE_CONFIG[variant];
  const Icon = config.icon;
  const ActionIcon = config.actionIcon;

  return (
    <div
      className={cn(
        "flex flex-1 flex-col items-center justify-center gap-5",
        "border-border/40 rounded-xl border-2 border-dashed",
        "from-muted/30 to-muted/10 bg-gradient-to-b",
        "mb-4 min-h-[280px] p-8",
        className
      )}
    >
      {/* Icon container with subtle gradient background */}
      <div
        className={cn(
          "relative flex size-20 items-center justify-center rounded-2xl",
          "from-muted/80 to-muted/40 bg-gradient-to-br",
          "ring-border/50 shadow-sm ring-1"
        )}
      >
        <Icon className="text-muted-foreground/70 size-10" strokeWidth={1.25} />
        {/* Subtle inner glow */}
        <div className="from-foreground/5 absolute inset-0 rounded-2xl bg-gradient-to-t to-transparent" />
      </div>

      {/* Text content */}
      <div className="max-w-xs text-center">
        <h3 className="text-foreground text-lg font-semibold tracking-tight text-balance">
          {config.title}
        </h3>
        <p className="text-muted-foreground mt-1.5 text-sm leading-relaxed">
          {config.description}
        </p>
      </div>

      {/* Action button - only render when onAction provided AND actionLabel non-empty */}
      {onAction && config.actionLabel && (
        <Button
          onClick={onAction}
          variant="outline"
          size="sm"
          className={cn(
            "mt-1 gap-1.5",
            "shadow-xs hover:shadow-sm",
            "transition-shadow duration-200"
          )}
        >
          <ActionIcon className="size-4" />
          {config.actionLabel}
        </Button>
      )}
    </div>
  );
}
