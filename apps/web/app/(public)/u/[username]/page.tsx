/**
 * Unified profile page displaying a user's items.
 * Shows full editing for owners, read-only view for visitors.
 * Features cinematic hero section with poster grid.
 *
 * All data is fetched at the page level so the previous page stays
 * visible during client-side navigation — no skeleton flash.
 */

import { Suspense } from "react";
import { notFound } from "next/navigation";
import { Metadata } from "next";
import { auth } from "@/lib/auth";
import { HomeShelves } from "@/components/homepage/home-shelves";
import { ShelfSkeleton } from "@/components/homepage/shelf-skeleton";
import {
  getPublicProfile,
  getProfileByIdOrUsername,
  getPublicLibraryProgress,
  getPublicPlaylistsForUser,
  getPublicItemsForUser,
} from "@/lib/public-auth";
import { getItemsForProfile, getLibraryProgress } from "@/lib/item-actions";
import { getUserPlaylists } from "@/lib/playlist-actions";
import { getCachedGoogleDriveConnection } from "@/lib/google-drive-data";
import { checkRateLimit } from "@/lib/rate-limit";
import { prisma } from "@/lib/prisma";
import { buildBreadcrumbJsonLd } from "@/lib/breadcrumb-jsonld";
import { SiteHeader } from "@/components/site-header";
import { PrivateResourceNotice } from "@/components/ui/private-resource-notice";
import { ProfilePage as ProfilePageContent } from "@/components/profile";
import { OAuthToast } from "@/components/google-drive";
import { ProfileContentSkeleton } from "@/components/skeletons/profile-content-skeleton";
import { profileSearchParamsCache } from "./search-params";

interface PageProps {
  params: Promise<{ username: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

/**
 * Generates metadata for the profile page.
 */
export async function generateMetadata({
  params,
}: PageProps): Promise<Metadata> {
  const { username } = await params;

  const session = await auth();
  const sessionUsername = session?.user?.username;
  const isOwnerByUsername =
    sessionUsername && sessionUsername.toLowerCase() === username.toLowerCase();

  const profile = isOwnerByUsername
    ? await getProfileByIdOrUsername(username)
    : await getPublicProfile(username);

  if (!profile) {
    return { title: "Profile Not Found" };
  }

  const displayName = profile.name ?? `@${profile.username}`;

  return {
    title: `${displayName} | CanonCore`,
    description: `View ${displayName}'s media library on CanonCore.`,
    alternates: {
      canonical: `/u/${username}`,
    },
    openGraph: {
      title: `${displayName} | CanonCore`,
      description: `View ${displayName}'s media library on CanonCore.`,
      type: "profile",
      username: profile.username,
    },
  };
}

/**
 * Unified profile page server component.
 * Fetches all data at the page level — no internal Suspense for main content.
 */
export default async function ProfilePage({ params, searchParams }: PageProps) {
  const { username } = await params;
  const resolvedSearchParams = await searchParams;

  // Dev-only: ?skeleton=true freezes the skeleton for visual comparison
  if (
    process.env.NODE_ENV === "development" &&
    resolvedSearchParams.skeleton === "true"
  ) {
    return (
      <>
        <SiteHeader title="My Items" titleHref={`/u/${username}`} />
        <div className="bg-background text-foreground -mt-(--header-height) flex flex-1 flex-col">
          <ProfileContentSkeleton />
        </div>
      </>
    );
  }

  const [rateLimitResult, session] = await Promise.all([
    checkRateLimit("publicProfile"),
    auth(),
  ]);

  if (rateLimitResult) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center">
        <p className="text-muted-foreground">
          Too many requests. Please try again later.
        </p>
      </div>
    );
  }

  const sessionUsername = session?.user?.username;
  const isOwnerByUsername =
    sessionUsername && sessionUsername.toLowerCase() === username.toLowerCase();

  const profile = isOwnerByUsername
    ? await getProfileByIdOrUsername(username)
    : await getPublicProfile(username);

  const currentUserId = session?.user?.id ?? null;

  if (!profile) {
    if (currentUserId) {
      const privateProfile = await prisma.user.findFirst({
        where: { username: { equals: username, mode: "insensitive" } },
        select: { id: true },
      });
      if (privateProfile?.id === currentUserId) {
        return (
          <>
            <SiteHeader title={`@${username}`} titleHref={`/u/${username}`} />
            <PrivateResourceNotice resourceType="profile" />
          </>
        );
      }
    }
    notFound();
  }

  const isOwner = currentUserId === profile.id;
  const driveConnection = isOwner
    ? await getCachedGoogleDriveConnection()
    : null;

  const appUrl = process.env.NEXT_PUBLIC_APP_URL || "https://canoncore.com";

  if (isOwner) {
    // ── Owner path ──────────────────────────────────────────────────────
    const [profileData, progress, playlistsResult] = await Promise.all([
      getItemsForProfile(profile.id, currentUserId),
      getLibraryProgress(),
      getUserPlaylists(),
    ]);

    return (
      <>
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify({
              "@context": "https://schema.org",
              "@type": "Person",
              name: profile.name ?? profile.username,
              url: `${appUrl}/u/${profile.username}`,
            }).replace(/</g, "\\u003c"),
          }}
        />
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify(
              buildBreadcrumbJsonLd([
                { name: "Home", url: appUrl },
                {
                  name: profile.name ?? `@${profile.username}`,
                  url: `${appUrl}/u/${profile.username}`,
                },
              ])
            ).replace(/</g, "\\u003c"),
          }}
        />
        <Suspense fallback={null}>
          <OAuthToast />
        </Suspense>
        <SiteHeader
          title="My Items"
          titleHref={`/u/${profile.username}`}
          emailUnverified={session?.user ? !session.user.emailVerified : false}
          driveNeedsReauth={driveConnection?.needsReauth ?? false}
        />
        <div className="bg-background text-foreground -mt-(--header-height) flex flex-1 flex-col">
          <ProfilePageContent
            profile={{
              id: profileData.profile.id,
              username: profileData.profile.username,
              name: profileData.profile.name,
              hasImage: profileData.profile.hasImage,
              hasHeroImage: profileData.profile.hasHeroImage,
              dominantColour: profileData.profile.dominantColour,
              bio: profileData.profile.bio,
            }}
            items={profileData.items}
            isOwner={true}
            hasDriveConnection={
              driveConnection !== null && !driveConnection.needsReauth
            }
            libraryProgress={progress}
            ownerPlaylists={
              playlistsResult?.success ? playlistsResult.data : undefined
            }
            shelves={
              <Suspense fallback={<ShelfSkeleton />}>
                <HomeShelves />
              </Suspense>
            }
          />
        </div>
      </>
    );
  }

  // ── Viewer path ─────────────────────────────────────────────────────
  const { q } = await profileSearchParamsCache.parse(searchParams);
  const search = q || undefined;

  const [viewerProgress, publicItems, publicPlaylists] = await Promise.all([
    getPublicLibraryProgress(profile.id),
    getPublicItemsForUser({
      userId: profile.id,
      search,
      currentUserId,
    }),
    getPublicPlaylistsForUser({ userId: profile.id, search }),
  ]);

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify({
            "@context": "https://schema.org",
            "@type": "Person",
            name: profile.name ?? profile.username,
            url: `${appUrl}/u/${profile.username}`,
          }).replace(/</g, "\\u003c"),
        }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(
            buildBreadcrumbJsonLd([
              { name: "Home", url: appUrl },
              {
                name: profile.name ?? `@${profile.username}`,
                url: `${appUrl}/u/${profile.username}`,
              },
            ])
          ).replace(/</g, "\\u003c"),
        }}
      />
      <SiteHeader
        title={`@${profile.username}`}
        titleHref={`/u/${profile.username}`}
        emailUnverified={session?.user ? !session.user.emailVerified : false}
      />
      <div className="bg-background text-foreground -mt-(--header-height) flex flex-1 flex-col">
        <ProfilePageContent
          profile={{
            id: profile.id,
            username: profile.username!,
            name: profile.name,
            hasImage: profile.hasImage,
            hasHeroImage: profile.hasHeroImage,
            dominantColour: profile.dominantColour,
            bio: profile.bio,
          }}
          items={[]}
          isOwner={false}
          viewerProgress={viewerProgress}
          initialViewerItems={publicItems}
          initialViewerPlaylists={publicPlaylists}
          initialSearch={q}
          publicPlaylists={publicPlaylists.items}
          currentUserId={currentUserId}
        />
      </div>
    </>
  );
}
