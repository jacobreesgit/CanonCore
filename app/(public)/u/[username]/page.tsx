/**
 * Public profile page displaying a user's public items.
 * Features cinematic hero section with staggered poster grid.
 */

import { notFound } from "next/navigation";
import { Metadata } from "next";
import { getPublicProfile, getPublicItemsForUser } from "@/lib/public-auth";
import { checkRateLimit } from "@/lib/rate-limit";
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

  // Rate limit profile views
  const rateLimitResult = await checkRateLimit("publicProfile");
  if (rateLimitResult) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center">
        <p className="text-muted-foreground">
          Too many requests. Please try again later.
        </p>
      </div>
    );
  }

  const profile = await getPublicProfile(username);

  if (!profile) {
    notFound();
  }

  const items = await getPublicItemsForUser(profile.id, 50, 0);

  return <PublicProfileClient profile={profile} items={items} />;
}
