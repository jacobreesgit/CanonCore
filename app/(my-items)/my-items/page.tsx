/**
 * My Items page displaying sortable items.
 * Server component that fetches items and renders the FilteredItemsView.
 */

import { FilteredItemsView } from "@/components/items";
import { getAllItems } from "@/lib/item-actions";
import {
  getSftpConnections,
  getAllItemsByConnection,
} from "@/lib/sftp-actions";
import { getProfile } from "@/lib/user-actions";
import { SiteHeader } from "@/components/site-header";

interface MyItemsPageProps {
  searchParams: Promise<{ connection?: string }>;
}

/**
 * Renders the My Items page with filterable items view.
 * Supports filtering by SFTP connection via URL query param.
 *
 * @param searchParams - URL search parameters (connection filter)
 */
export default async function MyItemsPage({ searchParams }: MyItemsPageProps) {
  const { connection: connectionId } = await searchParams;

  // Fetch items based on filter (server-side)
  const itemsResult = connectionId
    ? await getAllItemsByConnection(connectionId)
    : await getAllItems();

  const items = itemsResult.success ? (itemsResult.data ?? []) : [];

  // Fetch connections for filter dropdown
  const connectionsResult = await getSftpConnections();
  const connections = connectionsResult.success
    ? (connectionsResult.data ?? []).map((c) => ({ id: c.id, name: c.name }))
    : [];

  // Check if user has hero image
  const profileResult = await getProfile();
  const hasHeroImage =
    profileResult.success && profileResult.data?.hasHeroImage;

  return (
    <>
      <SiteHeader title="My Items" titleHref="/my-items" />
      <div className="flex flex-1 flex-col gap-4 px-4 py-6 md:px-6 lg:px-8">
        <FilteredItemsView
          initialItems={items}
          connections={connections}
          initialConnectionId={connectionId ?? null}
          heroTitle="My Items"
          hasHeroImage={hasHeroImage}
        />
      </div>
    </>
  );
}
