/**
 * Public item detail page displaying a single public item.
 * Shows item details with fork button for authenticated users.
 */

import { notFound } from "next/navigation";
import { Metadata } from "next";
import {
  getPublicProfile,
  getPublicItem,
  getPublicChildItems,
  getPublicBreadcrumb,
} from "@/lib/public-auth";
import { getForkStatus, getForkInfo } from "@/lib/fork-actions";
import { auth } from "@/lib/auth";
import { SiteHeader } from "@/components/site-header";
import { PublicItemClient } from "./public-item-client";

interface PageProps {
  params: Promise<{ username: string; itemId: string }>;
}

/**
 * Generates metadata for the public item page.
 */
export async function generateMetadata({
  params,
}: PageProps): Promise<Metadata> {
  const { username, itemId } = await params;

  const [profile, item] = await Promise.all([
    getPublicProfile(username),
    getPublicItem(itemId),
  ]);

  if (!profile || !item) {
    return { title: "Item Not Found" };
  }

  const displayName = profile.name ?? `@${profile.username}`;

  return {
    title: `${item.name} by ${displayName} | CanonCore`,
    description:
      item.description ??
      `View ${item.name} on ${displayName}'s public profile.`,
    openGraph: {
      title: `${item.name} | CanonCore`,
      description:
        item.description ??
        `View ${item.name} on ${displayName}'s public profile.`,
      type: "article",
    },
  };
}

/**
 * Public item detail page server component.
 */
export default async function PublicItemPage({ params }: PageProps) {
  const { username, itemId } = await params;

  // Verify profile and item exist and are public
  const [profile, item] = await Promise.all([
    getPublicProfile(username),
    getPublicItem(itemId),
  ]);

  if (!profile || !item) {
    notFound();
  }

  // Verify item belongs to this user
  if (item.userId !== profile.id) {
    notFound();
  }

  // Get additional data in parallel (including fork status for authenticated users)
  const [childItems, breadcrumb, forkInfo, session, forkStatusResult] =
    await Promise.all([
      getPublicChildItems(itemId, 50, 0),
      getPublicBreadcrumb(itemId),
      getForkInfo(itemId),
      auth(),
      getForkStatus(itemId), // Safe for unauthenticated - returns error
    ]);

  // Extract fork status if authenticated and request succeeded
  const forkStatus =
    session?.user?.id && "data" in forkStatusResult && forkStatusResult.data
      ? forkStatusResult.data
      : null;

  // Build breadcrumbs with hrefs for SiteHeader
  // Note: breadcrumb already includes current item from getPublicBreadcrumb
  const headerBreadcrumbs = (breadcrumb ?? []).map((crumb) => ({
    id: crumb.id,
    name: crumb.name,
    href: `/u/${profile.username}/${crumb.id}`,
  }));

  return (
    <>
      <SiteHeader
        title={`@${profile.username}`}
        titleHref={`/u/${profile.username}`}
        breadcrumbs={headerBreadcrumbs}
      />
      <div className="flex flex-1 flex-col gap-4 px-4 py-6 md:px-6 lg:px-8">
        <PublicItemClient
          profile={profile}
          item={item}
          childItems={childItems}
          forkInfo={"data" in forkInfo ? (forkInfo.data ?? null) : null}
          forkStatus={forkStatus}
          isAuthenticated={!!session?.user?.id}
          isOwnItem={session?.user?.id === profile.id}
        />
      </div>
    </>
  );
}
