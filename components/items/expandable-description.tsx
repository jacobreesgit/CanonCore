/**
 * About/description section with animated expand/collapse.
 * Uses Framer Motion for smooth height transitions.
 */

"use client";

import { useLayoutEffect, useRef, useState } from "react";
import { motion, useReducedMotion } from "motion/react";
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
 * About section with animated expandable descriptions.
 * Smoothly transitions height when toggling between collapsed and expanded states.
 */
export function AboutSection({
  description,
  title = "About",
  maxLines = 3,
  className,
}: AboutSectionProps) {
  const [expanded, setExpanded] = useState(false);
  const textRef = useRef<HTMLParagraphElement>(null);
  const [collapsedHeight, setCollapsedHeight] = useState<number | null>(null);
  const prefersReducedMotion = useReducedMotion();

  const needsExpansion = description.length > 200;
  const measured = collapsedHeight !== null;

  // Measure collapsed height before browser paints.
  // CSS line-clamp is applied via style prop on first render (SSR-safe),
  // then this effect takes over before the user sees anything.
  useLayoutEffect(() => {
    const el = textRef.current;
    if (!el || !needsExpansion) return;

    // Apply clamp to measure collapsed height
    Object.assign(el.style, {
      display: "-webkit-box",
      webkitLineClamp: String(maxLines),
      webkitBoxOrient: "vertical",
      overflow: "hidden",
    });
    const clamped = el.offsetHeight;
    const full = el.scrollHeight;

    // Clear inline measurement styles — motion.div takes over clipping
    el.style.cssText = "";

    if (full > clamped) {
      setCollapsedHeight(clamped);
    }
  }, [description, maxLines, needsExpansion]);

  return (
    <section className={className}>
      <h2
        className={cn(
          "mb-4 text-xs font-medium tracking-[0.2em] uppercase",
          "text-[var(--tertiary-foreground)]"
        )}
      >
        {title}
      </h2>

      <div>
        <motion.div
          initial={false}
          animate={{
            height: measured && !expanded ? collapsedHeight : "auto",
          }}
          transition={
            prefersReducedMotion
              ? { duration: 0 }
              : { duration: 0.35, ease: [0.25, 0.1, 0.25, 1] }
          }
          className="overflow-hidden"
        >
          <p
            ref={textRef}
            className={cn(
              "text-sm leading-relaxed md:text-base",
              "text-muted-foreground"
            )}
            style={
              needsExpansion && !measured
                ? {
                    display: "-webkit-box",
                    WebkitLineClamp: maxLines,
                    WebkitBoxOrient: "vertical" as const,
                    overflow: "hidden",
                  }
                : undefined
            }
          >
            {description}
          </p>
        </motion.div>

        {(needsExpansion || measured) && (
          <button
            onClick={() => setExpanded(!expanded)}
            className={cn(
              "mt-2 text-sm font-medium",
              "text-[var(--tertiary-foreground)]",
              "hover:text-muted-foreground",
              "transition-colors"
            )}
          >
            {expanded ? "Show less \u2191" : "Read more \u2193"}
          </button>
        )}
      </div>
    </section>
  );
}

export default AboutSection;
