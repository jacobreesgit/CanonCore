/**
 * Connection subfolder page displaying SFTP folder contents.
 * Shows children of the specified folder within a connection.
 */

import { notFound } from "next/navigation";
import { ItemsView } from "@/components/items";
import { getItem } from "@/lib/item-actions";
import { getSftpConnection, getItemsByConnection } from "@/lib/sftp-actions";

interface ConnectionItemPageProps {
  params: Promise<{ id: string; itemId: string }>;
}

/**
 * Renders a subfolder view within an SFTP connection.
 * Builds breadcrumb path from connection root to current folder.
 */
export default async function ConnectionItemPage({
  params,
}: ConnectionItemPageProps) {
  const { id: connectionId, itemId } = await params;

  // Verify connection exists and user owns it
  const connectionResult = await getSftpConnection(connectionId);
  if (!connectionResult.success || !connectionResult.data) {
    notFound();
  }

  // Get current item with ancestors for breadcrumbs
  const itemResult = await getItem(itemId);
  if (!itemResult.success || !itemResult.data) {
    notFound();
  }

  const { item, ancestors } = itemResult.data;

  // Security: verify item belongs to this connection
  if (item.connectionId !== connectionId) {
    notFound();
  }

  // Get children of current item
  const childrenResult = await getItemsByConnection(connectionId, itemId);
  const children = childrenResult.success ? (childrenResult.data ?? []) : [];

  // Build breadcrumbs: Connection > Ancestors > Current
  const breadcrumbs = [
    { id: connectionId, name: connectionResult.data.name },
    ...ancestors.map((a) => ({ id: a.id, name: a.name })),
    { id: item.id, name: item.name },
  ];

  return (
    <div className="flex flex-col gap-4 px-4 py-6 md:px-6 lg:px-8">
      <ItemsView
        items={children}
        parentId={itemId}
        connectionId={connectionId}
        breadcrumbs={breadcrumbs}
      />
    </div>
  );
}
