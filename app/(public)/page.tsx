/**
 * Public landing page.
 * Cinematic editorial design with dramatic typography.
 */

import type { Metadata } from "next";

import { SiteHeader } from "@/components/site-header";
import { HeroContent } from "./hero-content";

export const metadata: Metadata = {
  title: "CanonCore - Media Library Management",
  description:
    "Your all-in-one platform for managing and streaming your media library. Organize movies, TV shows, and music with powerful item hierarchies and Google Drive integration.",
};

/**
 * Renders the landing page with cinematic hero.
 */
export default function LandingPage() {
  return (
    <>
      <SiteHeader title="Home" titleHref="/" />
      <main className="flex-1 overflow-y-auto md:overflow-hidden">
        <HeroContent />
      </main>
    </>
  );
}
