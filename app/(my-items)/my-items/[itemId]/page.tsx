/**
 * Item detail page displaying item contents and attached files.
 * Shows hero banner, children, and any media files attached to this item.
 */

import { notFound } from "next/navigation";
import { ItemDetailClient } from "@/components/items";
import { SiteHeader } from "@/components/site-header";
import { getItem, getDescendants } from "@/lib/item-actions";
import { getItemFiles } from "@/lib/item-file-actions";

interface ItemDetailPageProps {
  params: Promise<{ itemId: string }>;
}

/**
 * Renders the item detail view with hero, files, and children.
 * ItemDetailClient handles all layout variations.
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

  // Fetch descendants of current item and attached files in parallel
  const [childrenResult, filesResult] = await Promise.all([
    getDescendants(itemId),
    getItemFiles(itemId),
  ]);

  const childItems = childrenResult.success ? (childrenResult.data ?? []) : [];
  const files =
    filesResult.success && filesResult.data
      ? filesResult.data
      : { media: [], artwork: [], subtitles: [] };

  return (
    <>
      <SiteHeader
        title="My Items"
        titleHref="/my-items"
        breadcrumbs={breadcrumbs}
      />
      <div className="flex flex-1 flex-col gap-4 px-4 py-6 md:px-6 lg:px-8">
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
