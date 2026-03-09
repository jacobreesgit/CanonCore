/**
 * Unified profile page displaying a user's items.
 * Shows full editing for owners, read-only view for visitors.
 * Features cinematic hero section with poster grid.
 *
 * Renders a fast shell (header + skeleton) immediately, then streams
 * heavy content (items, playlists, shelves) via Suspense.
 */

import { Suspense } from "react";
import { notFound } from "next/navigation";
import { Metadata } from "next";
import { auth } from "@/lib/auth";
import { HomeShelves, ShelfSkeleton } from "@/components/homepage/home-shelves";
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

  // Check auth to determine ownership (mirrors page component logic)
  const session = await auth();
  const sessionUsername = session?.user?.username;
  const isOwnerByUsername =
    sessionUsername && sessionUsername.toLowerCase() === username.toLowerCase();

  const profile = isOwnerByUsername
    ? await getProfileByIdOrUsername(username)
    : await getPublicProfile(username);

  if (!profile) {
    return {
      title: "Profile Not Found",
    };
  }

  const displayName = profile.name ?? `@${profile.username}`;

  return {
    title: `${displayName} | CanonCore`,
    description: `View ${displayName}'s media library on CanonCore.`,
    openGraph: {
      title: `${displayName} | CanonCore`,
      description: `View ${displayName}'s media library on CanonCore.`,
      type: "profile",
      username: profile.username,
    },
  };
}

/**
 * Async server component that fetches all heavy profile data.
 * Rendered inside a Suspense boundary so the page shell streams first.
 */
async function ProfileContent({
  profileId,
  currentUserId,
  isOwner,
  profile,
  searchParams,
}: {
  profileId: string;
  currentUserId: string | null;
  isOwner: boolean;
  profile: {
    id: string;
    username: string;
    name: string | null;
    hasImage: boolean;
    hasHeroImage: boolean;
    dominantColour: string | null;
    bio: string | null;
  };
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  if (isOwner) {
    // Owner path — unpaginated (needs all items for tree/drag-drop)
    const [profileData, driveConnection, progress, playlistsResult] =
      await Promise.all([
        getItemsForProfile(profileId, currentUserId),
        getCachedGoogleDriveConnection(),
        getLibraryProgress(),
        getUserPlaylists(),
      ]);

    return (
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
    );
  }

  // Viewer path — paginated with search
  const { q } = await profileSearchParamsCache.parse(searchParams);
  const search = q || undefined;

  const [viewerProgress, publicItems, publicPlaylists] = await Promise.all([
    getPublicLibraryProgress(profileId),
    getPublicItemsForUser({ userId: profileId, search, currentUserId }),
    getPublicPlaylistsForUser({ userId: profileId, search }),
  ]);

  return (
    <ProfilePageContent
      profile={{
        id: profile.id,
        username: profile.username,
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
  );
}

/**
 * Unified profile page server component.
 * Renders a fast shell (header + skeleton), then streams content via Suspense.
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

  // Parallelize rate limit + auth check
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

  // Check if this is the owner viewing their own profile (case-insensitive)
  const isOwnerByUsername =
    sessionUsername && sessionUsername.toLowerCase() === username.toLowerCase();

  // For owners, we fetch profile directly without requiring isPublic
  // For visitors, we use getPublicProfile which requires isPublic: true
  const profile = isOwnerByUsername
    ? await getProfileByIdOrUsername(username)
    : await getPublicProfile(username);

  const currentUserId = session?.user?.id ?? null;

  if (!profile) {
    // Lightweight ownership check: show hint if owner views their own private profile
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
      {isOwner && (
        <Suspense fallback={null}>
          <OAuthToast />
        </Suspense>
      )}
      <SiteHeader
        title={isOwner ? "My Items" : `@${profile.username}`}
        titleHref={`/u/${profile.username}`}
        emailUnverified={session?.user ? !session.user.emailVerified : false}
        driveNeedsReauth={driveConnection?.needsReauth ?? false}
      />
      <div className="bg-background text-foreground -mt-(--header-height) flex flex-1 flex-col">
        <Suspense fallback={<ProfileContentSkeleton />}>
          <ProfileContent
            profileId={profile.id}
            currentUserId={currentUserId}
            isOwner={isOwner}
            profile={{
              id: profile.id,
              username: profile.username!,
              name: profile.name,
              hasImage: profile.hasImage,
              hasHeroImage: profile.hasHeroImage,
              dominantColour: profile.dominantColour,
              bio: profile.bio,
            }}
            searchParams={searchParams}
          />
        </Suspense>
      </div>
    </>
  );
}
