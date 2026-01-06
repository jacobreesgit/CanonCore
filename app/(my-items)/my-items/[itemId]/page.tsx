/**
 * Item detail page displaying item contents and attached files.
 * Shows children of the specified item, breadcrumb navigation,
 * and any media files attached to this item.
 */

import { notFound } from "next/navigation";
import { ItemDetail, ItemDetailClient, ItemsToolbar } from "@/components/items";
import { SiteHeader } from "@/components/site-header";
import { getItem, getItems } from "@/lib/item-actions";
import { getItemFiles } from "@/lib/item-file-actions";

interface ItemDetailPageProps {
  params: Promise<{ itemId: string }>;
}

/**
 * Renders the item detail view with its children and attached files.
 * Shows tabs for navigating between child items and media files.
 */
export default async function ItemDetailPage({ params }: ItemDetailPageProps) {
  const { itemId } = await params;

  // Fetch the current item with ancestors for breadcrumbs
  const itemResult = await getItem(itemId);

  if (!itemResult.success || !itemResult.data) {
    notFound();
  }

  const { item, ancestors } = itemResult.data;

  // Build breadcrumbs with hrefs for SiteHeader
  const breadcrumbs = [...ancestors, { id: item.id, name: item.name }].map(
    (a) => ({
      id: a.id,
      name: a.name,
      href: `/my-items/${a.id}`,
    })
  );

  // Fetch children of current item and attached files in parallel
  const [childrenResult, filesResult] = await Promise.all([
    getItems(itemId),
    getItemFiles(itemId),
  ]);

  const childItems = childrenResult.success ? (childrenResult.data ?? []) : [];
  const files =
    filesResult.success && filesResult.data
      ? filesResult.data
      : { media: [], artwork: [], subtitles: [] };

  const hasChildren = childItems.length > 0;
  const hasFiles =
    files.media.length > 0 ||
    files.artwork.length > 0 ||
    files.subtitles.length > 0;

  // Check if item is connected to SFTP
  const isSftpConnected = Boolean(item.connectionId && item.sftpPath);

  // If no files, just show the items view with unified toolbar
  if (!hasFiles) {
    return (
      <>
        <SiteHeader
          title="My Items"
          titleHref="/my-items"
          breadcrumbs={breadcrumbs}
        />
        <div className="flex flex-col gap-4 px-4 py-6 md:px-6 lg:px-8">
          <ItemDetailClient
            item={{
              id: item.id,
              name: item.name,
              description: item.description,
              connectionId: item.connectionId,
              sftpPath: item.sftpPath,
            }}
            childItems={childItems}
            connection={item.connection}
          />
        </div>
      </>
    );
  }

  // If has files but no children, show file detail view with toolbar
  if (!hasChildren) {
    return (
      <>
        <SiteHeader
          title="My Items"
          titleHref="/my-items"
          breadcrumbs={breadcrumbs}
        />
        <div className="flex flex-col gap-4 px-4 py-6 md:px-6 lg:px-8">
          <ItemsToolbar
            hasItems={false}
            item={{
              id: item.id,
              name: item.name,
              description: item.description,
            }}
            childCount={0}
            isSftpConnected={isSftpConnected}
          />
          <ItemDetail item={item} files={files} />
        </div>
      </>
    );
  }

  // If has both, show tabbed view with unified toolbar
  return (
    <>
      <SiteHeader
        title="My Items"
        titleHref="/my-items"
        breadcrumbs={breadcrumbs}
      />
      <div className="flex flex-col gap-4 px-4 py-6 md:px-6 lg:px-8">
        <ItemDetailClient
          item={{
            id: item.id,
            name: item.name,
            description: item.description,
            connectionId: item.connectionId,
            sftpPath: item.sftpPath,
          }}
          childItems={childItems}
          connection={item.connection}
          files={files}
        />
      </div>
    </>
  );
}
