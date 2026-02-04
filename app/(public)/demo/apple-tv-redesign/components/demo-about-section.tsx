/**
 * About/description section with expandable text.
 */

"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";

interface DemoAboutSectionProps {
  /** Description text. */
  description: string;
  /** Section title. */
  title?: string;
  /** Max lines before truncation. */
  maxLines?: number;
  /** Additional CSS classes. */
  className?: string;
}

/**
 * About section with expandable long descriptions.
 */
export function DemoAboutSection({
  description,
  title = "About",
  maxLines = 3,
  className,
}: DemoAboutSectionProps) {
  const [expanded, setExpanded] = useState(false);

  // Check if text is long enough to need expansion
  const needsExpansion = description.length > 200;

  return (
    <section className={className}>
      <h2
        className={cn(
          "mb-4 text-xs font-medium tracking-[0.2em] uppercase",
          "text-[var(--atv-text-tertiary)]"
        )}
      >
        {title}
      </h2>

      <div>
        <p
          className={cn(
            "text-sm leading-relaxed md:text-base",
            "text-[var(--atv-text-secondary)]",
            !expanded && needsExpansion && `line-clamp-${maxLines}`
          )}
          style={
            !expanded && needsExpansion
              ? { WebkitLineClamp: maxLines, display: "-webkit-box" }
              : undefined
          }
        >
          {description}
        </p>

        {needsExpansion && (
          <button
            onClick={() => setExpanded(!expanded)}
            className={cn(
              "mt-2 text-sm font-medium",
              "text-[var(--atv-text-tertiary)]",
              "hover:text-[var(--atv-text-secondary)]",
              "transition-colors"
            )}
          >
            {expanded ? "Show less ↑" : "Read more ↓"}
          </button>
        )}
      </div>
    </section>
  );
}
