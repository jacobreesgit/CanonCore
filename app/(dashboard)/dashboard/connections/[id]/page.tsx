/**
 * Connection detail page displaying SFTP folder contents.
 * Shows root-level items for the connection with sync/upload capabilities.
 */

import { notFound } from "next/navigation";
import { ItemsView } from "@/components/items";
import { getSftpConnection, getItemsByConnection } from "@/lib/sftp-actions";

interface ConnectionDetailPageProps {
  params: Promise<{ id: string }>;
}

/**
 * Renders the SFTP connection root folder view.
 * Displays items at the connection's base path.
 */
export default async function ConnectionDetailPage({
  params,
}: ConnectionDetailPageProps) {
  const { id } = await params;

  // Verify connection exists and user owns it
  const connectionResult = await getSftpConnection(id);
  if (!connectionResult.success || !connectionResult.data) {
    notFound();
  }

  // Get root-level items for this connection
  const itemsResult = await getItemsByConnection(id, null);
  const items = itemsResult.success ? (itemsResult.data ?? []) : [];

  // Breadcrumbs: just the connection name at root level
  const breadcrumbs = [{ id, name: connectionResult.data.name }];

  return (
    <div className="flex flex-col gap-4 px-4 py-6 md:px-6 lg:px-8">
      <ItemsView
        items={items}
        parentId={null}
        connectionId={id}
        breadcrumbs={breadcrumbs}
      />
    </div>
  );
}
