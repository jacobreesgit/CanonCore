/**
 * Item detail page displaying folder contents.
 * Shows children of the specified folder with breadcrumb navigation.
 */

import { notFound } from "next/navigation";
import { ItemsView } from "@/components/items";
import { getItem, getItems } from "@/lib/item-actions";

interface ItemDetailPageProps {
  params: Promise<{ itemId: string }>;
}

/**
 * Renders the folder detail view with its children.
 * Builds breadcrumb path from root to current folder.
 */
export default async function ItemDetailPage({ params }: ItemDetailPageProps) {
  const { itemId } = await params;

  // Fetch the current item with ancestors for breadcrumbs
  const itemResult = await getItem(itemId);

  if (!itemResult.success || !itemResult.data) {
    notFound();
  }

  const { item, ancestors } = itemResult.data;

  // Include current item in breadcrumbs
  const breadcrumbs = [...ancestors, { id: item.id, name: item.name }];

  // Fetch children of current item
  const childrenResult = await getItems(itemId);
  const childItems = childrenResult.success ? (childrenResult.data ?? []) : [];

  return (
    <div className="flex flex-col gap-4 px-4 py-6 md:px-6 lg:px-8">
      <ItemsView
        items={childItems}
        parentId={itemId}
        breadcrumbs={breadcrumbs}
      />
    </div>
  );
}
