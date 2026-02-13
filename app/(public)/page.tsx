/**
 * Public landing page.
 * Cinematic editorial design with dramatic typography.
 */

import type { Metadata } from "next";

import { auth } from "@/lib/auth";
import { getGoogleDriveConnection } from "@/lib/google-drive-actions";
import { SiteHeader } from "@/components/site-header";
import { HeroContent } from "./landing-hero";

export const metadata: Metadata = {
  title: "CanonCore - Media Library Management",
  description:
    "Your all-in-one platform for managing and streaming your media library. Organize movies, TV shows, and music with powerful item hierarchies and Google Drive integration.",
};

/**
 * Renders the landing page with cinematic hero.
 */
export default async function LandingPage() {
  const session = await auth();
  const driveConnection = session?.user
    ? await getGoogleDriveConnection()
    : null;
  const driveNeedsReauth = driveConnection?.needsReauth ?? false;

  return (
    <>
      <SiteHeader
        title="Home"
        titleHref="/"
        driveNeedsReauth={driveNeedsReauth}
      />
      <main className="flex-1 overflow-y-auto">
        <HeroContent />
      </main>
    </>
  );
}
