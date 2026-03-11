import { cn } from "@/lib/utils";

/** Glassmorphism menu item styling shared by all context menus and dropdown menus. */
export const MENU_ITEM_CLASSES = cn(
  "gap-2 rounded-lg px-3 py-2",
  "text-sm",
  "text-muted-foreground",
  "hover:bg-white/10 hover:text-foreground",
  "focus:bg-white/10 focus:text-foreground",
  "cursor-pointer"
);

/** Destructive menu item styling for delete/remove actions. */
export const DELETE_ITEM_CLASSES = cn(
  "gap-2 rounded-lg px-3 py-2",
  "text-sm",
  "text-red-400",
  "hover:bg-red-500/10 hover:text-red-300",
  "focus:bg-red-500/10 focus:text-red-300",
  "cursor-pointer"
);
