/**
 * Wiki integration accordion placeholder.
 * Shows locked sections with "Coming Soon" messaging.
 */

import { Lock, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";
import type { WikiSection } from "@/lib/mock-data";
import { MOCK_WIKI_SECTIONS_MOVIE } from "@/lib/mock-data";

interface WikiAccordionProps {
  /** Wiki sections to display. */
  sections?: WikiSection[];
  /** Additional CSS classes. */
  className?: string;
}

/**
 * Displays locked wiki sections as a placeholder for future integration.
 */
export function WikiAccordion({
  sections = MOCK_WIKI_SECTIONS_MOVIE,
  className,
}: WikiAccordionProps) {
  return (
    <section className={className} data-testid="about-wiki-section">
      <h2
        className={cn(
          "mb-4 text-xs font-medium tracking-[0.2em] uppercase",
          "text-[var(--tertiary-foreground)]"
        )}
      >
        Learn More
      </h2>

      {/* Accordion sections */}
      <div
        className={cn(
          "overflow-hidden rounded-xl",
          "bg-white/[0.04] backdrop-blur-md",
          "border border-white/[0.06]"
        )}
      >
        {sections.map((section, index) => (
          <div
            key={section.id}
            className={cn(
              "flex items-center justify-between",
              "px-4 py-3",
              "cursor-not-allowed opacity-60",
              index < sections.length - 1 && "border-b border-white/[0.06]"
            )}
          >
            <div className="flex items-center gap-3">
              <ChevronRight
                className="size-4 text-[var(--tertiary-foreground)]"
                aria-hidden="true"
              />
              <span className="text-muted-foreground text-sm">
                {section.title}
              </span>
            </div>
            <Lock
              className="size-4 text-[var(--tertiary-foreground)]"
              aria-hidden="true"
            />
          </div>
        ))}
      </div>

      {/* Coming soon message */}
      <p className="mt-3 text-xs text-[var(--tertiary-foreground)]">
        Wiki integration coming soon. Connect your MediaWiki source for rich
        content about plot, production, and trivia.
      </p>
    </section>
  );
}

export default WikiAccordion;
