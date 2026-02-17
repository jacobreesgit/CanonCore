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
    "Your all-in-one platform for managing and streaming your media library. Organise movies, TV shows, and music with powerful item hierarchies and Google Drive integration.",
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
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify({
            "@context": "https://schema.org",
            "@type": "WebApplication",
            name: "CanonCore",
            url: process.env.NEXT_PUBLIC_APP_URL || "https://canoncore.com",
            description: "Organise, track, and share your media library.",
            applicationCategory: "Entertainment",
            operatingSystem: "Web",
          }).replace(/</g, "\\u003c"),
        }}
      />
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
