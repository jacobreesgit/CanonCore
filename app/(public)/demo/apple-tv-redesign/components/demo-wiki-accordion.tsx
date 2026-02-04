/**
 * Wiki integration accordion placeholder.
 * Shows locked sections with "Coming Soon" messaging.
 */

import { Lock, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";

interface WikiSection {
  /** Section ID. */
  id: string;
  /** Section title. */
  title: string;
}

interface DemoWikiAccordionProps {
  /** Wiki sections to display. */
  sections?: WikiSection[];
  /** Additional CSS classes. */
  className?: string;
}

/** Default wiki sections for movies/shows. */
const DEFAULT_MOVIE_SECTIONS: WikiSection[] = [
  { id: "plot", title: "Plot Summary" },
  { id: "production", title: "Production History" },
  { id: "reception", title: "Critical Reception" },
  { id: "trivia", title: "Trivia & Facts" },
];

/** Default wiki sections for TV shows. */
const DEFAULT_TV_SECTIONS: WikiSection[] = [
  { id: "plot", title: "Plot Summary" },
  { id: "episodes", title: "Episode Guide" },
  { id: "production", title: "Production History" },
  { id: "reception", title: "Reception & Awards" },
];

/**
 * Displays locked wiki sections as a placeholder for future integration.
 */
export function DemoWikiAccordion({
  sections = DEFAULT_MOVIE_SECTIONS,
  className,
}: DemoWikiAccordionProps) {
  return (
    <section className={className}>
      <h2
        className={cn(
          "mb-4 text-xs font-medium tracking-[0.2em] uppercase",
          "text-[var(--atv-text-tertiary)]"
        )}
      >
        Learn More
      </h2>

      {/* Accordion sections */}
      <div
        className={cn(
          "overflow-hidden rounded-lg",
          "border border-[var(--atv-border)]",
          "bg-[var(--atv-surface)]/50"
        )}
      >
        {sections.map((section, index) => (
          <div
            key={section.id}
            className={cn(
              "flex items-center justify-between",
              "px-4 py-3",
              "cursor-not-allowed opacity-60",
              index < sections.length - 1 &&
                "border-b border-[var(--atv-border)]"
            )}
          >
            <div className="flex items-center gap-3">
              <ChevronRight
                className="size-4 text-[var(--atv-text-tertiary)]"
                aria-hidden="true"
              />
              <span className="text-sm text-[var(--atv-text-secondary)]">
                {section.title}
              </span>
            </div>
            <Lock
              className="size-4 text-[var(--atv-text-tertiary)]"
              aria-hidden="true"
            />
          </div>
        ))}
      </div>

      {/* Coming soon message */}
      <p className="mt-3 text-xs text-[var(--atv-text-tertiary)]">
        Wiki integration coming soon. Connect your MediaWiki source for rich
        content about plot, production, and trivia.
      </p>
    </section>
  );
}

export { DEFAULT_MOVIE_SECTIONS, DEFAULT_TV_SECTIONS };
