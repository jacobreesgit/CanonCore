/**
 * Connection subfolder page displaying SFTP folder contents.
 * Shows children of the specified folder within a connection,
 * and any media files attached to this item.
 */

import { notFound } from "next/navigation";
import { ItemsView, ItemDetail } from "@/components/items";
import { SiteHeader } from "@/components/site-header";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Folder, Film } from "lucide-react";
import { getItem } from "@/lib/item-actions";
import { getItemFiles } from "@/lib/item-file-actions";
import { getSftpConnection, getItemsByConnection } from "@/lib/sftp-actions";

interface ConnectionItemPageProps {
  params: Promise<{ id: string; itemId: string }>;
}

/**
 * Renders a subfolder view within an SFTP connection.
 * Shows tabs for navigating between children folders and media files.
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

  // Get children and files of current item in parallel
  const [childrenResult, filesResult] = await Promise.all([
    getItemsByConnection(connectionId, itemId),
    getItemFiles(itemId),
  ]);

  const children = childrenResult.success ? (childrenResult.data ?? []) : [];
  const files =
    filesResult.success && filesResult.data
      ? filesResult.data
      : { media: [], artwork: [], subtitles: [] };

  const hasChildren = children.length > 0;
  const hasFiles =
    files.media.length > 0 ||
    files.artwork.length > 0 ||
    files.subtitles.length > 0;

  // Build breadcrumbs with hrefs for SiteHeader
  // Connection root is first, then ancestors, then current item
  const allItems = [
    { id: connectionId, name: connectionResult.data.name },
    ...ancestors.map((a) => ({ id: a.id, name: a.name })),
    { id: item.id, name: item.name },
  ];
  const breadcrumbs = allItems.map((a, i) => ({
    id: a.id,
    name: a.name,
    href:
      i === 0
        ? `/dashboard/connections/${connectionId}`
        : `/dashboard/connections/${connectionId}/${a.id}`,
  }));

  // If no files, just show the items view
  if (!hasFiles) {
    return (
      <>
        <SiteHeader
          title="Connections"
          titleHref="/dashboard/connections"
          breadcrumbs={breadcrumbs}
        />
        <div className="flex flex-col gap-4 px-4 py-6 md:px-6 lg:px-8">
          <ItemsView
            items={children}
            parentId={itemId}
            connectionId={connectionId}
          />
        </div>
      </>
    );
  }

  // If has files but no children, show file detail view
  if (!hasChildren) {
    return (
      <>
        <SiteHeader
          title="Connections"
          titleHref="/dashboard/connections"
          breadcrumbs={breadcrumbs}
        />
        <div className="flex flex-col gap-4 px-4 py-6 md:px-6 lg:px-8">
          <ItemDetail item={item} files={files} />
        </div>
      </>
    );
  }

  // If has both, show tabs
  return (
    <>
      <SiteHeader
        title="Connections"
        titleHref="/dashboard/connections"
        breadcrumbs={breadcrumbs}
      />
      <div className="flex flex-col gap-4 px-4 py-6 md:px-6 lg:px-8">
        <Tabs defaultValue="files" className="w-full">
          <TabsList className="mb-6">
            <TabsTrigger value="files" className="gap-2">
              <Film className="size-4" />
              Media ({files.media.length})
            </TabsTrigger>
            <TabsTrigger value="folders" className="gap-2">
              <Folder className="size-4" />
              Subfolders ({children.length})
            </TabsTrigger>
          </TabsList>

          <TabsContent value="files">
            <ItemDetail item={item} files={files} />
          </TabsContent>

          <TabsContent value="folders">
            <ItemsView
              items={children}
              parentId={itemId}
              connectionId={connectionId}
            />
          </TabsContent>
        </Tabs>
      </div>
    </>
  );
}
