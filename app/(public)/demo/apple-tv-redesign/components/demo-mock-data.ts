/**
 * Mock data constants for Apple TV+ demo interactive components.
 * Provides folder structure, sort/filter options for no-op UI demonstrations.
 */

/** Mock folder structure for fork destination dialog. */
export interface MockFolder {
  id: string;
  name: string;
  depth: number;
  parentId?: string;
  hasChildren: boolean;
}

export const MOCK_FOLDERS: MockFolder[] = [
  { id: "folder-1", name: "Movies", depth: 0, hasChildren: true },
  {
    id: "folder-2",
    name: "Action",
    depth: 1,
    parentId: "folder-1",
    hasChildren: false,
  },
  {
    id: "folder-3",
    name: "Comedy",
    depth: 1,
    parentId: "folder-1",
    hasChildren: false,
  },
  {
    id: "folder-4",
    name: "Drama",
    depth: 1,
    parentId: "folder-1",
    hasChildren: true,
  },
  {
    id: "folder-5",
    name: "Award Winners",
    depth: 2,
    parentId: "folder-4",
    hasChildren: false,
  },
  { id: "folder-6", name: "TV Shows", depth: 0, hasChildren: true },
  {
    id: "folder-7",
    name: "Currently Watching",
    depth: 1,
    parentId: "folder-6",
    hasChildren: false,
  },
  {
    id: "folder-8",
    name: "Completed",
    depth: 1,
    parentId: "folder-6",
    hasChildren: false,
  },
  { id: "folder-9", name: "Documentaries", depth: 0, hasChildren: false },
  { id: "folder-10", name: "Watch Later", depth: 0, hasChildren: false },
];

/** Sort option configuration. */
export interface DemoSortOption {
  value: string;
  label: string;
}

export const DEMO_SORT_OPTIONS: DemoSortOption[] = [
  { value: "custom", label: "Custom Order" },
  { value: "name-asc", label: "Name A-Z" },
  { value: "name-desc", label: "Name Z-A" },
  { value: "updated-desc", label: "Recently Updated" },
  { value: "updated-asc", label: "Oldest First" },
];

/** Filter option configuration. */
export interface DemoFilterOption {
  value: string;
  label: string;
}

export const DEMO_FILTER_OPTIONS: DemoFilterOption[] = [
  { value: "all", label: "All Items" },
  { value: "has-files", label: "Has Files" },
  { value: "no-files", label: "No Files" },
  { value: "synced", label: "Synced" },
  { value: "pending", label: "Pending" },
];

/** Context menu action types. */
export type ContextMenuAction =
  | "settings"
  | "pin"
  | "unpin"
  | "delete"
  | "add-child";

/** Toast messages for context menu actions. */
export const CONTEXT_MENU_TOASTS: Record<ContextMenuAction, string> = {
  settings: "Settings dialog would open",
  pin: "Pinned to sidebar!",
  unpin: "Unpinned from sidebar",
  delete: "Item deleted",
  "add-child": "Add item dialog would open",
};
