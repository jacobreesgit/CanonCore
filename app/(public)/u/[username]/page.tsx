/**
 * Unified profile page displaying a user's items.
 * Shows full editing for owners, read-only view for visitors.
 * Features cinematic hero section with poster grid.
 */

import { Suspense } from "react";
import { notFound } from "next/navigation";
import { Metadata } from "next";
import { auth } from "@/lib/auth";
import {
  getPublicProfile,
  getProfileByIdOrUsername,
  getPublicLibraryProgress,
} from "@/lib/public-auth";
import { getItemsForProfile, getLibraryProgress } from "@/lib/item-actions";
import { getGoogleDriveConnection } from "@/lib/google-drive-actions";
import { checkRateLimit } from "@/lib/rate-limit";
import { SiteHeader } from "@/components/site-header";
import { ProfilePage as ProfilePageContent } from "@/components/profile";
import { OAuthToast } from "@/components/google-drive";

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
 * Unified profile page server component.
 * Fetches profile and items based on viewer/owner mode.
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

  // Fetch items using unified function (handles owner/viewer mode internally)
  const profileData = await getItemsForProfile(profile.id, currentUserId);

  // For owners, also fetch Drive connection and library progress
  let hasDriveConnection = false;
  let driveNeedsReauth = false;
  let libraryProgress = null;

  if (isOwner) {
    const [driveConnection, progress] = await Promise.all([
      getGoogleDriveConnection(),
      getLibraryProgress(),
    ]);
    hasDriveConnection =
      driveConnection !== null && !driveConnection.needsReauth;
    driveNeedsReauth = driveConnection?.needsReauth ?? false;
    libraryProgress = progress;
  }

  // For viewers, fetch public library progress
  let viewerProgress = null;
  if (!isOwner) {
    viewerProgress = await getPublicLibraryProgress(profile.id);
  }

  return (
    <>
      {isOwner && (
        <Suspense fallback={null}>
          <OAuthToast />
        </Suspense>
      )}
      <SiteHeader
        title={isOwner ? "My Items" : `@${profile.username}`}
        titleHref={`/u/${profile.username}`}
        driveNeedsReauth={driveNeedsReauth}
      />
      <div className="bg-background text-foreground flex flex-1 flex-col">
        <ProfilePageContent
          profile={{
            id: profileData.profile.id,
            username: profileData.profile.username,
            name: profileData.profile.name,
            hasImage: profileData.profile.hasImage,
            hasHeroImage: profileData.profile.hasHeroImage,
          }}
          items={profileData.items}
          isOwner={isOwner}
          hasDriveConnection={hasDriveConnection}
          libraryProgress={libraryProgress}
          viewerProgress={viewerProgress}
        />
      </div>
    </>
  );
}
