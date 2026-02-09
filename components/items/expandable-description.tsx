/**
 * About/description section with expandable text.
 */

"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";

interface AboutSectionProps {
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
export function AboutSection({
  description,
  title = "About",
  maxLines = 3,
  className,
}: AboutSectionProps) {
  const [expanded, setExpanded] = useState(false);

  // Check if text is long enough to need expansion
  const needsExpansion = description.length > 200;

  return (
    <section className={className} data-testid="about-description-section">
      <h2
        className={cn(
          "mb-4 text-xs font-medium tracking-[0.2em] uppercase",
          "text-[var(--tertiary-foreground)]"
        )}
      >
        {title}
      </h2>

      <div>
        <p
          className={cn(
            "text-sm leading-relaxed md:text-base",
            "text-muted-foreground",
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
            data-testid="read-more-button"
            onClick={() => setExpanded(!expanded)}
            className={cn(
              "mt-2 text-sm font-medium",
              "text-[var(--tertiary-foreground)]",
              "hover:text-muted-foreground",
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

export default AboutSection;
