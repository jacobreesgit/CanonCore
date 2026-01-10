/**
 * My Items page displaying sortable items.
 * Server component that fetches items and renders the ItemsView.
 */

import { Suspense } from "react";
import { ItemsView } from "@/components/items";
import { getAllItems } from "@/lib/item-actions";
import { getProfile } from "@/lib/user-actions";
import { getGoogleDriveConnection } from "@/lib/google-drive-actions";
import { OAuthToast } from "@/components/google-drive";
import { SiteHeader } from "@/components/site-header";

/**
 * Renders the My Items page with items view.
 * Displays all user items with hero banner.
 */
export default async function MyItemsPage() {
  // Fetch all items
  const itemsResult = await getAllItems();
  const items = itemsResult.success ? (itemsResult.data ?? []) : [];

  // Check if user has hero image
  const profileResult = await getProfile();
  const hasHeroImage =
    profileResult.success && profileResult.data?.hasHeroImage;

  // Check for Google Drive connection
  const driveConnection = await getGoogleDriveConnection();
  const hasDriveConnection =
    driveConnection !== null && !driveConnection.needsReauth;

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
          hasDriveConnection={hasDriveConnection}
        />
      </div>
    </>
  );
}
