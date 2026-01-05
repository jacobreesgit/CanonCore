/**
 * Item detail page displaying folder contents and attached files.
 * Shows children of the specified folder, breadcrumb navigation,
 * and any media files attached to this item.
 */

import { notFound } from "next/navigation";
import { ItemsView, ItemDetail } from "@/components/items";
import { SiteHeader } from "@/components/site-header";
import { getItem, getItems } from "@/lib/item-actions";
import { getItemFiles } from "@/lib/item-file-actions";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Folder, Film } from "lucide-react";

interface ItemDetailPageProps {
  params: Promise<{ itemId: string }>;
}

/**
 * Renders the folder detail view with its children and attached files.
 * Shows tabs for navigating between children folders and media files.
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
      href: `/dashboard/${a.id}`,
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

  // If no files, just show the items view
  if (!hasFiles) {
    return (
      <>
        <SiteHeader
          title="My Files"
          titleHref="/dashboard"
          breadcrumbs={breadcrumbs}
        />
        <div className="flex flex-col gap-4 px-4 py-6 md:px-6 lg:px-8">
          <ItemsView items={childItems} parentId={itemId} />
        </div>
      </>
    );
  }

  // If has files but no children, show file detail view
  if (!hasChildren) {
    return (
      <>
        <SiteHeader
          title="My Files"
          titleHref="/dashboard"
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
        title="My Files"
        titleHref="/dashboard"
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
              Subfolders ({childItems.length})
            </TabsTrigger>
          </TabsList>

          <TabsContent value="files">
            <ItemDetail item={item} files={files} />
          </TabsContent>

          <TabsContent value="folders">
            <ItemsView items={childItems} parentId={itemId} />
          </TabsContent>
        </Tabs>
      </div>
    </>
  );
}
