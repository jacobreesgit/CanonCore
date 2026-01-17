/**
 * Pinned items navigation section for the sidebar.
 * Displays user's pinned items with folder icons and context menu.
 */

"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { Folder, PinOff, Settings, Trash2 } from "lucide-react";
import { toast } from "sonner";
import type { PinnedItem } from "@/lib/types";

import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuTrigger,
} from "@/components/ui/context-menu";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import {
  SidebarGroup,
  SidebarGroupLabel,
  SidebarGroupContent,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar";
import { unpinItem, deleteItem } from "@/lib/item-actions";
import { cn } from "@/lib/utils";

interface NavPinnedItemsProps {
  items: PinnedItem[];
}

/**
 * Renders pinned items in the sidebar with folder icons and context menu.
 *
 * @param items - Array of pinned items to display
 */
export function NavPinnedItems({ items }: NavPinnedItemsProps) {
  const pathname = usePathname();
  const router = useRouter();
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [itemToDelete, setItemToDelete] = useState<PinnedItem | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  // Don't render anything if no pinned items
  if (items.length === 0) {
    return null;
  }

  async function handleUnpin(id: string) {
    const result = await unpinItem(id);
    if (result.success) {
      toast.success("Unpinned from sidebar");
      router.refresh();
    } else {
      toast.error(result.error || "Failed to unpin item");
    }
  }

  async function handleDelete() {
    if (!itemToDelete) return;
    setIsDeleting(true);
    try {
      const result = await deleteItem(itemToDelete.id);
      if (result.success) {
        toast.success(`Deleted "${itemToDelete.name}"`);
        setDeleteDialogOpen(false);
        router.refresh();
      } else {
        toast.error(result.error || "Failed to delete item");
      }
    } finally {
      setIsDeleting(false);
    }
  }

  function openDeleteDialog(item: PinnedItem) {
    setItemToDelete(item);
    setDeleteDialogOpen(true);
  }

  return (
    <>
      <SidebarGroup>
        <SidebarGroupLabel>Pinned</SidebarGroupLabel>
        <SidebarGroupContent>
          <SidebarMenu>
            {items.map((item) => {
              const href = `/my-items/${item.id}`;
              const isActive =
                pathname === href || pathname.startsWith(`${href}/`);

              return (
                <ContextMenu key={item.id}>
                  <ContextMenuTrigger asChild>
                    <SidebarMenuItem>
                      <SidebarMenuButton
                        tooltip={item.name}
                        asChild
                        isActive={isActive}
                      >
                        <Link href={href}>
                          <Folder className="size-4" aria-hidden="true" />
                          <span>{item.name}</span>
                        </Link>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  </ContextMenuTrigger>
                  <ContextMenuContent className="w-52">
                    <ContextMenuItem
                      onClick={() => router.push(`${href}?settings=true`)}
                      className="gap-2"
                    >
                      <Settings className="size-4" strokeWidth={2} />
                      <span>Settings</span>
                    </ContextMenuItem>
                    <ContextMenuItem
                      onClick={() => handleUnpin(item.id)}
                      className="gap-2"
                    >
                      <PinOff className="size-4" strokeWidth={2} />
                      <span>Unpin from Sidebar</span>
                    </ContextMenuItem>
                    <ContextMenuSeparator />
                    <ContextMenuItem
                      onClick={() => openDeleteDialog(item)}
                      className={cn(
                        "gap-2",
                        "text-destructive focus:text-destructive focus:bg-destructive/10"
                      )}
                    >
                      <Trash2 className="size-4" strokeWidth={2} />
                      <span>Delete</span>
                    </ContextMenuItem>
                  </ContextMenuContent>
                </ContextMenu>
              );
            })}
          </SidebarMenu>
        </SidebarGroupContent>
      </SidebarGroup>

      {/* Delete Confirmation Dialog */}
      <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Delete Item</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete &ldquo;{itemToDelete?.name}
              &rdquo;? This will also delete all child items. This action cannot
              be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setDeleteDialogOpen(false)}
              disabled={isDeleting}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={handleDelete}
              disabled={isDeleting}
            >
              {isDeleting ? "Deleting..." : "Delete"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
