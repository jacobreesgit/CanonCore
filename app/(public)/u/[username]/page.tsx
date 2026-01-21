/**
 * Public profile page displaying a user's public items.
 * Features cinematic hero section with staggered poster grid.
 */

import { notFound } from "next/navigation";
import { Metadata } from "next";
import { auth } from "@/lib/auth";
import { getPublicProfile, getPublicItemsForUser } from "@/lib/public-auth";
import { checkRateLimit } from "@/lib/rate-limit";
import { SiteHeader } from "@/components/site-header";
import { PublicProfileClient } from "./public-profile-client";

interface PageProps {
  params: Promise<{ username: string }>;
}

/**
 * Generates metadata for the public profile page.
 */
export async function generateMetadata({
  params,
}: PageProps): Promise<Metadata> {
  const { username } = await params;
  const profile = await getPublicProfile(username);

  if (!profile) {
    return {
      title: "Profile Not Found",
    };
  }

  const displayName = profile.name ?? `@${profile.username}`;

  return {
    title: `${displayName} | CanonCore`,
    description: `View ${displayName}'s public media collection on CanonCore.`,
    openGraph: {
      title: `${displayName} | CanonCore`,
      description: `View ${displayName}'s public media collection on CanonCore.`,
      type: "profile",
      username: profile.username,
    },
  };
}

/**
 * Public profile page server component.
 * Fetches profile and items data, renders client component.
 */
export default async function PublicProfilePage({ params }: PageProps) {
  const { username } = await params;

  // Rate limit and fetch profile in parallel
  const [rateLimitResult, profile, session] = await Promise.all([
    checkRateLimit("publicProfile"),
    getPublicProfile(username),
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

  if (!profile) {
    notFound();
  }

  const currentUserId = session?.user?.id ?? null;
  const items = await getPublicItemsForUser(profile.id, 50, 0, currentUserId);

  return (
    <>
      <SiteHeader
        title={`@${profile.username}`}
        titleHref={`/u/${profile.username}`}
      />
      <div className="flex flex-1 flex-col gap-4 px-4 py-6 md:px-6 lg:px-8">
        <PublicProfileClient
          profile={profile}
          items={items}
          currentUserId={currentUserId}
        />
      </div>
    </>
  );
}
