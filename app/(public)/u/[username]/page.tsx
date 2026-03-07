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
} from "@/lib/public-auth";
import { getItemsForProfile, getLibraryProgress } from "@/lib/item-actions";
import { getUserPlaylists } from "@/lib/playlist-actions";
import { getCachedGoogleDriveConnection } from "@/lib/google-drive-data";
import { checkRateLimit } from "@/lib/rate-limit";
import { SiteHeader } from "@/components/site-header";
import { ProfilePage as ProfilePageContent } from "@/components/profile";
import { OAuthToast } from "@/components/google-drive";
import { ProfileContentSkeleton } from "@/components/skeletons/profile-content-skeleton";

interface PageProps {
  params: Promise<{ username: string }>;
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
}: {
  profileId: string;
  currentUserId: string | null;
  isOwner: boolean;
}) {
  // Fetch items (includes profile hasImage/hasHeroImage)
  const profileData = await getItemsForProfile(profileId, currentUserId);

  // For owners, fetch Drive connection, library progress, and playlists
  let hasDriveConnection = false;
  let libraryProgress = null;
  let ownerPlaylists: Awaited<ReturnType<typeof getUserPlaylists>> | null =
    null;

  if (isOwner) {
    const [driveConnection, progress, playlistsResult] = await Promise.all([
      getCachedGoogleDriveConnection(),
      getLibraryProgress(),
      getUserPlaylists(),
    ]);
    hasDriveConnection =
      driveConnection !== null && !driveConnection.needsReauth;
    libraryProgress = progress;
    ownerPlaylists = playlistsResult;
  }

  // For viewers, fetch public library progress and playlists
  let viewerProgress = null;
  let publicPlaylists: Awaited<ReturnType<typeof getPublicPlaylistsForUser>> =
    [];
  if (!isOwner) {
    [viewerProgress, publicPlaylists] = await Promise.all([
      getPublicLibraryProgress(profileId),
      getPublicPlaylistsForUser(profileId),
    ]);
  }

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
      isOwner={isOwner}
      hasDriveConnection={hasDriveConnection}
      libraryProgress={libraryProgress}
      viewerProgress={viewerProgress}
      publicPlaylists={publicPlaylists}
      ownerPlaylists={ownerPlaylists?.success ? ownerPlaylists.data : undefined}
      shelves={
        isOwner ? (
          <Suspense fallback={<ShelfSkeleton />}>
            <HomeShelves />
          </Suspense>
        ) : undefined
      }
    />
  );
}

/**
 * Unified profile page server component.
 * Renders a fast shell (header + skeleton), then streams content via Suspense.
 */
export default async function ProfilePage({ params }: PageProps) {
  const { username } = await params;

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

  if (!profile) {
    notFound();
  }

  const currentUserId = session?.user?.id ?? null;
  const isOwner = currentUserId === profile.id;
  const driveConnection = isOwner
    ? await getCachedGoogleDriveConnection()
    : null;

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify({
            "@context": "https://schema.org",
            "@type": "Person",
            name: profile.name ?? profile.username,
            url: `${process.env.NEXT_PUBLIC_APP_URL || "https://canoncore.com"}/u/${profile.username}`,
          }).replace(/</g, "\\u003c"),
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
          />
        </Suspense>
      </div>
    </>
  );
}
