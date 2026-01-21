/**
 * My Items page displaying sortable items.
 * Server component that fetches items and renders the ItemsView.
 */

import { Suspense } from "react";
import { ItemsView } from "@/components/items";
import { getAllItems, getLibraryProgress } from "@/lib/item-actions";
import { getProfile } from "@/lib/user-actions";
import { getGoogleDriveConnection } from "@/lib/google-drive-actions";
import { OAuthToast } from "@/components/google-drive";
import { SiteHeader } from "@/components/site-header";

/**
 * Renders the My Items page with items view.
 * Displays all user items with hero banner.
 */
export default async function MyItemsPage() {
  // Fetch items, profile, Drive connection, and library progress in parallel
  const [itemsResult, profileResult, driveConnection, libraryProgress] =
    await Promise.all([
      getAllItems(),
      getProfile(),
      getGoogleDriveConnection(),
      getLibraryProgress(),
    ]);

  const items = itemsResult.success ? (itemsResult.data ?? []) : [];
  const profile = profileResult.success ? profileResult.data : null;
  const hasHeroImage = profile?.hasHeroImage ?? false;
  const hasDriveConnection =
    driveConnection !== null && !driveConnection.needsReauth;
  const currentUser = profile
    ? {
        id: profile.id,
        username: profile.username ?? null,
        name: profile.name ?? null,
      }
    : null;

  return (
    <>
      <Suspense fallback={null}>
        <OAuthToast />
      </Suspense>
      <SiteHeader title="My Items" titleHref="/my-items" />
      <div className="flex flex-1 flex-col gap-4 px-4 py-6 md:px-6 lg:px-8">
        <ItemsView
          items={items}
          heroTitle="My Items"
          heroBackgroundUrl={hasHeroImage ? "/api/user/hero" : undefined}
          heroProgress={libraryProgress}
          hasDriveConnection={hasDriveConnection}
          currentUser={currentUser}
        />
      </div>
    </>
  );
}
