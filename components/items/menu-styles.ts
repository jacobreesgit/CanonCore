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
