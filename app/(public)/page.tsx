/**
 * Public landing page.
 * Cinematic editorial design with dramatic typography.
 */

import type { Metadata } from "next";

import { auth } from "@/lib/auth";
import { getGoogleDriveConnection } from "@/lib/google-drive-actions";
import { SiteHeader } from "@/components/site-header";
import { HomepageContent } from "@/components/homepage/homepage-content";

export const metadata: Metadata = {
  title: "CanonCore - Media Library Management",
  description:
    "Your all-in-one platform for managing and streaming your media library. Organise movies, TV shows, and music with powerful item hierarchies and Google Drive integration.",
};

/**
 * Renders the landing page with cinematic hero.
 */
export default async function LandingPage() {
  const [session, driveConnection] = await Promise.all([
    auth(),
    getGoogleDriveConnection().catch(() => null),
  ]);
  const driveNeedsReauth = session?.user
    ? (driveConnection?.needsReauth ?? false)
    : false;

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
      {/* Pull homepage up behind the glass header so mesh gradient bleeds through */}
      <div className="-mt-(--header-height)">
        <HomepageContent />
      </div>
    </>
  );
}
