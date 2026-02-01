/**
 * Main navigation section for the sidebar.
 * Contains search trigger and primary navigation items.
 * My Items can have pinned items as collapsible children.
 */

"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  type LucideIcon,
  Search,
  ChevronRight,
  Pin,
  PinOff,
  Settings,
  Trash2,
} from "lucide-react";
import { toast } from "sonner";

import { AnimatePresence, motion, useReducedMotion } from "motion/react";
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
  SidebarGroupContent,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarMenuSub,
  SidebarMenuSubButton,
  SidebarMenuSubItem,
} from "@/components/ui/sidebar";
import { Kbd } from "@/components/ui/kbd";
import { useSpotlightOptional } from "@/contexts/spotlight-context";
import { unpinItem, deleteItem } from "@/lib/item-actions";
import { cn } from "@/lib/utils";
import type { PinnedItem } from "@/lib/types";

interface NavItem {
  title: string;
  url: string;
  icon?: LucideIcon;
}

interface NavMainProps {
  /** Navigation items to display */
  items: NavItem[];
  /** Pinned items to show under My Items */
  pinnedItems?: PinnedItem[];
  /** Current user's username for building item URLs */
  username?: string | null;
}

/**
 * Renders the main navigation section.
 * Includes spotlight search button when SpotlightProvider is available.
 * My Items shows pinned items as collapsible children.
 *
 * @param items - Array of navigation items with title, url, and optional icon
 * @param pinnedItems - Array of pinned items to show under My Items
 * @param username - Current user's username for building item URLs
 */
export function NavMain({ items, pinnedItems = [], username }: NavMainProps) {
  const pathname = usePathname();
  const router = useRouter();
  const spotlight = useSpotlightOptional();
  const prefersReducedMotion = useReducedMotion();

  // Delete dialog state
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [itemToDelete, setItemToDelete] = useState<PinnedItem | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  // Build base URL for user's items (profile page)
  const myItemsBaseUrl = username ? `/u/${username}` : null;

  // Check if any pinned item is active (for auto-expand)
  const hasPinnedItems = pinnedItems.length > 0;
  const hasActivePinned = pinnedItems.some((item) => {
    if (!myItemsBaseUrl) return false;
    const href = `${myItemsBaseUrl}/${item.id}`;
    return pathname === href || pathname.startsWith(`${href}/`);
  });

  // My Items is expanded when it has pinned items and either My Items or a pinned item is active
  const isMyItemsPath = myItemsBaseUrl
    ? pathname === myItemsBaseUrl || pathname.startsWith(`${myItemsBaseUrl}/`)
    : false;
  const [isOpen, setIsOpen] = useState(hasActivePinned || isMyItemsPath);

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
        <SidebarGroupContent>
          <SidebarMenu>
            {spotlight && (
              <SidebarMenuItem>
                <SidebarMenuButton
                  onClick={spotlight.openSpotlight}
                  tooltip="Search"
                  className="group"
                >
                  <Search aria-hidden="true" className="size-4" />
                  <span>Search</span>
                  <Kbd className="ml-auto">/</Kbd>
                </SidebarMenuButton>
              </SidebarMenuItem>
            )}
            {items.map((item) => {
              // My Items uses dynamic URL from username
              const isMyItems = item.title === "My Items";

              // Use prefix matching for section awareness
              const isActive = isMyItems
                ? isMyItemsPath
                : item.url === "/explore"
                  ? pathname === "/explore" ||
                    (pathname.startsWith("/u/") && !isMyItemsPath)
                  : pathname === item.url ||
                    pathname.startsWith(`${item.url}/`);

              // My Items with pinned children - render as expandable
              if (isMyItems && hasPinnedItems) {
                return (
                  <SidebarMenuItem key={item.title}>
                    {/* Wrapper to keep chevron positioned relative to just the link row */}
                    <div className="relative flex items-center">
                      <SidebarMenuButton
                        tooltip={item.title}
                        asChild
                        isActive={isActive && !hasActivePinned}
                      >
                        <Link href={item.url}>
                          {item.icon && <item.icon aria-hidden="true" />}
                          <span>{item.title}</span>
                        </Link>
                      </SidebarMenuButton>
                      <button
                        type="button"
                        onClick={() => setIsOpen(!isOpen)}
                        className={cn(
                          "hover:bg-sidebar-accent absolute right-1 cursor-pointer rounded-md p-1.5 transition-colors",
                          isActive &&
                            !hasActivePinned &&
                            "hover:bg-background/20"
                        )}
                        aria-label={isOpen ? "Collapse" : "Expand"}
                        aria-expanded={isOpen}
                      >
                        <ChevronRight
                          className={cn(
                            "size-4 transition-transform",
                            isOpen && "rotate-90",
                            isActive && !hasActivePinned && "text-background"
                          )}
                        />
                      </button>
                    </div>
                    <AnimatePresence initial={false}>
                      {isOpen && (
                        <motion.div
                          initial={
                            prefersReducedMotion
                              ? false
                              : { height: 0, opacity: 0 }
                          }
                          animate={{ height: "auto", opacity: 1 }}
                          exit={
                            prefersReducedMotion
                              ? undefined
                              : { height: 0, opacity: 0 }
                          }
                          transition={
                            prefersReducedMotion
                              ? { duration: 0 }
                              : { duration: 0.2, ease: "easeInOut" }
                          }
                          style={{ overflow: "hidden" }}
                        >
                          <SidebarMenuSub>
                            {pinnedItems.map((pinnedItem) => {
                              const href = myItemsBaseUrl
                                ? `${myItemsBaseUrl}/${pinnedItem.id}`
                                : "#";
                              const isPinnedActive =
                                pathname === href ||
                                pathname.startsWith(`${href}/`);

                              return (
                                <ContextMenu key={pinnedItem.id}>
                                  <ContextMenuTrigger asChild>
                                    <SidebarMenuSubItem>
                                      <SidebarMenuSubButton
                                        asChild
                                        isActive={isPinnedActive}
                                      >
                                        <Link href={href}>
                                          <Pin
                                            className="size-4"
                                            aria-hidden="true"
                                          />
                                          <span>{pinnedItem.name}</span>
                                        </Link>
                                      </SidebarMenuSubButton>
                                    </SidebarMenuSubItem>
                                  </ContextMenuTrigger>
                                  <ContextMenuContent className="w-52">
                                    <ContextMenuItem
                                      onClick={() =>
                                        router.push(`${href}?settings=true`)
                                      }
                                      className="gap-2"
                                    >
                                      <Settings
                                        aria-hidden="true"
                                        className="size-4"
                                        strokeWidth={2}
                                      />
                                      <span>Settings</span>
                                    </ContextMenuItem>
                                    <ContextMenuItem
                                      onClick={() => handleUnpin(pinnedItem.id)}
                                      className="gap-2"
                                    >
                                      <PinOff
                                        aria-hidden="true"
                                        className="size-4"
                                        strokeWidth={2}
                                      />
                                      <span>Unpin from Sidebar</span>
                                    </ContextMenuItem>
                                    <ContextMenuSeparator />
                                    <ContextMenuItem
                                      onClick={() =>
                                        openDeleteDialog(pinnedItem)
                                      }
                                      className={cn(
                                        "gap-2",
                                        "text-destructive focus:text-destructive focus:bg-destructive/10"
                                      )}
                                    >
                                      <Trash2
                                        aria-hidden="true"
                                        className="size-4"
                                        strokeWidth={2}
                                      />
                                      <span>Delete</span>
                                    </ContextMenuItem>
                                  </ContextMenuContent>
                                </ContextMenu>
                              );
                            })}
                          </SidebarMenuSub>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </SidebarMenuItem>
                );
              }

              // Regular nav item (no children)
              return (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton
                    tooltip={item.title}
                    asChild
                    isActive={isActive}
                  >
                    <Link href={item.url}>
                      {item.icon && <item.icon aria-hidden="true" />}
                      <span>{item.title}</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
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
              {isDeleting ? "Deleting…" : "Delete"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
