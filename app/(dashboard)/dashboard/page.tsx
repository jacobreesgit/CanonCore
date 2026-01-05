/**
 * Main dashboard page displaying sortable items (folders).
 * Server component that fetches items and renders the ItemsView.
 */

import { ItemsView } from "@/components/items";
import { getItems } from "@/lib/item-actions";
import { SiteHeader } from "@/components/site-header";

/**
 * Renders the dashboard with sortable items view.
 * Items at root level (parentId = null) are displayed.
 */
export default async function DashboardPage() {
  const result = await getItems(null);
  const items = result.success ? (result.data ?? []) : [];

  return (
    <>
      <SiteHeader title="My Files" titleHref="/dashboard" />
      <div className="flex flex-col gap-4 px-4 py-6 md:px-6 lg:px-8">
        <ItemsView items={items} parentId={null} />
      </div>
    </>
  );
}
