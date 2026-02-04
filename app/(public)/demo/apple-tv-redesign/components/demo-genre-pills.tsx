/**
 * Horizontal genre pill badges with glassmorphism styling.
 */

import { cn } from "@/lib/utils";

interface DemoGenrePillsProps {
  /** Array of genre names. */
  genres: string[];
  /** Maximum number of pills to show. */
  maxPills?: number;
  /** Additional CSS classes. */
  className?: string;
}

/**
 * Displays genre names as horizontal pill badges.
 */
export function DemoGenrePills({
  genres,
  maxPills = 4,
  className,
}: DemoGenrePillsProps) {
  const visibleGenres = genres.slice(0, maxPills);

  return (
    <div className={cn("flex flex-wrap gap-2", className)}>
      {visibleGenres.map((genre) => (
        <span
          key={genre}
          className={cn(
            "inline-flex items-center",
            "rounded-full px-3 py-1",
            "text-sm font-medium",
            "bg-white/10 backdrop-blur-sm",
            "border border-white/20",
            "text-white/90",
            "transition-colors duration-150",
            "hover:bg-white/15"
          )}
        >
          {genre}
        </span>
      ))}
    </div>
  );
}
