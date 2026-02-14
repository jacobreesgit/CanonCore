/**
 * Cinematic editorial landing hero.
 * Centered dramatic typography with atmospheric glow and feature grid.
 */

"use client";

import { motion } from "motion/react";
import {
  ArrowRight,
  Clapperboard,
  GitFork,
  History,
  Layers,
  Tv,
} from "lucide-react";
import Link from "next/link";
import { SiGoogledrive } from "react-icons/si";

import { useSession } from "next-auth/react";
import dynamic from "next/dynamic";
import type { FeatureItem } from "@/components/feature-card-grid";

const FeatureCardGrid = dynamic(
  () =>
    import("@/components/feature-card-grid").then((mod) => ({
      default: mod.FeatureCardGrid,
    })),
  { ssr: false }
);
import { HeroButton } from "@/components/items/hero-button";

const features: FeatureItem[] = [
  {
    icon: Layers,
    title: "Infinite Hierarchy",
    description:
      "Nest movies in franchises, episodes in seasons, as deep as you need.",
    color: "text-sky-500",
    bgColor: "bg-sky-500/10",
    href: "/docs/files-and-folders/organise",
  },
  {
    icon: SiGoogledrive,
    title: "Drive Sync",
    description:
      "Bidirectional sync with Google Drive. Your files, your control.",
    color: "text-green-500",
    bgColor: "bg-green-500/10",
    href: "/docs/google-drive/sync-files",
  },
  {
    icon: Clapperboard,
    title: "Rich Metadata",
    description: "One click fetches posters, backdrops, and cast from TMDB.",
    color: "text-pink-500",
    bgColor: "bg-pink-500/10",
    href: "/docs/files-and-folders/item-settings",
  },
  {
    icon: History,
    title: "Progress Tracking",
    description: "Resume exactly where you left off, on any device.",
    color: "text-purple-500",
    bgColor: "bg-purple-500/10",
    href: "/docs/google-drive/progress-tracking",
  },
  {
    icon: GitFork,
    title: "Public Profiles",
    description:
      "Share collections with a link. Let others fork what they love.",
    color: "text-brand",
    bgColor: "bg-brand/10",
    href: "/docs/sharing/public-profile",
  },
  {
    icon: Tv,
    title: "Stream Anywhere",
    description: "Phone, tablet, laptop, TV. Your library travels with you.",
    color: "text-green-500",
    bgColor: "bg-green-500/10",
    href: "/docs/google-drive/media-playback",
  },
];

const ease = [0.25, 0.46, 0.45, 0.94] as const;

/**
 * Cinematic landing hero with centered typography and feature grid.
 */
export function HeroContent() {
  const { data: session, status } = useSession();
  const username = session?.user?.username as string | undefined;
  const sessionReady = status !== "loading";
  return (
    <section className="bg-background relative overflow-hidden">
      {/* Atmospheric background — layered gradient orbs */}
      <div className="pointer-events-none absolute inset-0">
        {/* Center top glow */}
        <div
          className="absolute inset-0"
          style={{
            background:
              "radial-gradient(ellipse 70% 40% at 50% 0%, rgba(255, 255, 255, 0.04), transparent)",
          }}
        />
        {/* Warm accent — left */}
        <div
          className="absolute inset-0 hidden md:block"
          style={{
            background:
              "radial-gradient(ellipse 40% 50% at 20% 30%, rgba(251, 146, 60, 0.03), transparent 70%)",
          }}
        />
        {/* Cool accent — right */}
        <div
          className="absolute inset-0 hidden md:block"
          style={{
            background:
              "radial-gradient(ellipse 40% 50% at 80% 30%, rgba(56, 189, 248, 0.03), transparent 70%)",
          }}
        />
        {/* Deep glow — center bottom */}
        <div
          className="absolute inset-0"
          style={{
            background:
              "radial-gradient(ellipse 60% 30% at 50% 100%, rgba(255, 255, 255, 0.02), transparent)",
          }}
        />
      </div>

      <div className="relative z-10 mx-auto flex max-w-5xl flex-col px-6">
        {/* Hero — centered editorial */}
        <div className="flex flex-col items-center py-24 text-center md:py-32 lg:py-40">
          {/* Headline */}
          <motion.h1
            className="max-w-3xl text-5xl leading-[1.08] font-semibold tracking-tight md:text-6xl lg:text-7xl"
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.1, ease }}
          >
            Your media library.
            <br />
            <span className="from-foreground/70 via-foreground/40 to-foreground/20 bg-gradient-to-r bg-clip-text text-transparent">
              Elevated.
            </span>
          </motion.h1>

          {/* Subtitle */}
          <motion.p
            className="text-muted-foreground mt-6 max-w-xl text-lg leading-relaxed md:text-xl"
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.25, ease }}
          >
            CanonCore syncs with Google Drive to organise, stream, and share
            your personal media collection.
          </motion.p>

          {/* CTAs */}
          <motion.div
            className="mt-10 flex flex-wrap items-center justify-center gap-4"
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.4, ease }}
          >
            <HeroButton variant="primary" asChild>
              <Link href={username ? `/u/${username}` : "/sign-up"}>
                {!sessionReady
                  ? "\u00A0" /* nbsp placeholder while loading */
                  : username
                    ? "My Items"
                    : "Get Started"}
              </Link>
            </HeroButton>
            <HeroButton asChild className="group">
              <Link href="/explore">
                Explore Collections
                <ArrowRight className="size-4 transition-transform group-hover:translate-x-1" />
              </Link>
            </HeroButton>
          </motion.div>
        </div>

        {/* Gradient divider */}
        <div className="mx-auto w-full max-w-2xl">
          <div
            className="h-px"
            style={{
              background:
                "linear-gradient(to right, transparent, var(--glass-border), rgba(255, 255, 255, 0.12), var(--glass-border), transparent)",
            }}
          />
        </div>

        {/* Feature grid */}
        <div className="py-20 md:py-24">
          <motion.h2
            className="mb-8 text-center text-3xl font-semibold tracking-tight md:text-4xl"
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.55, ease }}
          >
            Features that speak for{" "}
            <span className="text-muted-foreground">themselves</span>
          </motion.h2>
          <motion.div
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.65, ease }}
          >
            <FeatureCardGrid items={features} />
          </motion.div>
        </div>
      </div>
    </section>
  );
}
