/**
 * Apple-inspired product landing with bold typography and clean grid.
 * Premium, confident, minimal — every element earns its place.
 */

"use client";

import { motion } from "framer-motion";
import {
  Clapperboard,
  GitFork,
  History,
  Layers,
  Tv,
  type LucideIcon,
} from "lucide-react";
import { SiGoogledrive } from "react-icons/si";
import type { IconType } from "react-icons";

interface Feature {
  icon: LucideIcon | IconType;
  title: string;
  description: string;
}

const features: Feature[] = [
  {
    icon: Layers,
    title: "Infinite Hierarchy",
    description:
      "Nest movies in franchises, episodes in seasons, as deep as you need.",
  },
  {
    icon: SiGoogledrive,
    title: "Drive Sync",
    description:
      "Bidirectional sync with Google Drive. Your files, your control.",
  },
  {
    icon: Clapperboard,
    title: "Rich Metadata",
    description: "One click fetches posters, backdrops, and cast from TMDB.",
  },
  {
    icon: History,
    title: "Progress Tracking",
    description: "Resume exactly where you left off, on any device.",
  },
  {
    icon: GitFork,
    title: "Public Profiles",
    description:
      "Share collections with a link. Let others fork what they love.",
  },
  {
    icon: Tv,
    title: "Stream Anywhere",
    description: "Phone, tablet, laptop, TV. Your library travels with you.",
  },
];

/**
 * Apple-style product hero with bold headline and clean feature grid.
 */
export function HeroContent() {
  return (
    <section className="bg-background relative flex min-h-full flex-col items-center justify-start overflow-hidden px-6 py-8 md:justify-center md:py-0">
      {/* Subtle top gradient */}
      <div
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            "radial-gradient(ellipse 80% 40% at 50% 0%, oklch(from var(--foreground) l c h / 0.02), transparent)",
        }}
      />

      {/* Content container */}
      <div className="relative z-10 flex w-full max-w-5xl flex-col items-center">
        {/* Hero text */}
        <motion.div
          className="mb-16 text-center"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{
            duration: 0.8,
            ease: [0.25, 0.46, 0.45, 0.94] as const,
          }}
        >
          <h1
            data-testid="landing-hero-title"
            className="mb-4 text-4xl font-semibold tracking-tight md:text-5xl lg:text-6xl"
          >
            Your media library.
            <br />
            <span className="from-foreground/60 to-foreground/40 bg-gradient-to-r bg-clip-text text-transparent">
              Elevated.
            </span>
          </h1>
          <p className="text-muted-foreground mx-auto max-w-2xl text-lg md:text-xl">
            CanonCore syncs with Google Drive to organise, stream, and share
            your personal media collection.
          </p>
        </motion.div>

        {/* Feature grid - 3x2 */}
        <div className="grid w-full grid-cols-2 gap-4 md:grid-cols-3 md:gap-5">
          {features.map((feature, idx) => {
            const Icon = feature.icon;
            return (
              <motion.div
                key={feature.title}
                className="group border-border/50 bg-card/50 hover:border-border hover:bg-card flex cursor-pointer flex-col items-center rounded-2xl border p-6 text-center shadow-sm transition-all duration-300 hover:shadow-md"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{
                  delay: 0.3 + idx * 0.08,
                  duration: 0.6,
                  ease: [0.25, 0.46, 0.45, 0.94] as const,
                }}
              >
                {/* Icon */}
                <div className="bg-foreground/[0.05] group-hover:bg-foreground/[0.08] mb-4 flex size-12 items-center justify-center rounded-xl transition-colors duration-300">
                  <Icon className="text-foreground/70 group-hover:text-foreground size-6 transition-colors duration-300" />
                </div>

                {/* Title */}
                <h3 className="mb-2 text-base font-semibold tracking-tight md:text-lg">
                  {feature.title}
                </h3>

                {/* Description */}
                <p className="text-muted-foreground text-sm leading-relaxed md:text-base">
                  {feature.description}
                </p>
              </motion.div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
