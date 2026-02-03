/**
 * Storybook stories for the NavMain component.
 * Demonstrates main navigation with pinned items in sidebar.
 */

import type { Meta, StoryObj } from "@storybook/nextjs";
import { Folder, Compass } from "lucide-react";

import { NavMain } from "./nav-main";
import {
  SidebarProvider,
  Sidebar,
  SidebarContent,
} from "@/components/ui/sidebar";
import { SpotlightProvider } from "@/contexts/spotlight-context";
import type { PinnedItem } from "@/lib/types";

const meta = {
  title: "Navigation/NavMain",
  component: NavMain,
  tags: ["autodocs"],
  parameters: {
    layout: "centered",
    docs: {
      description: {
        component:
          "Main navigation section with search, nav items, and collapsible pinned items under My Items.",
      },
    },
    nextjs: {
      appDirectory: true,
      navigation: {
        pathname: "/u/johndoe",
      },
    },
  },
  decorators: [
    (Story) => (
      <SpotlightProvider>
        <SidebarProvider defaultOpen={true}>
          <Sidebar>
            <SidebarContent>
              <Story />
            </SidebarContent>
          </Sidebar>
        </SidebarProvider>
      </SpotlightProvider>
    ),
  ],
} satisfies Meta<typeof NavMain>;

export default meta;
type Story = StoryObj<typeof meta>;

const navItems = [
  { title: "My Items", url: "/u/johndoe", icon: Folder },
  { title: "Explore", url: "/explore", icon: Compass },
];

// TMDB-style pinned items
const pinnedItems: PinnedItem[] = [
  { id: "movies", name: "Movies", pinnedOrder: 0, isPublic: true },
  { id: "tv-shows", name: "TV Shows", pinnedOrder: 1, isPublic: true },
  { id: "anime", name: "Anime", pinnedOrder: 2, isPublic: false },
];

/**
 * Default navigation with pinned items expanded.
 * Shows My Items with collapsible pinned items section.
 */
export const WithPinnedItems: Story = {
  args: {
    items: navItems,
    pinnedItems: pinnedItems,
    username: "johndoe",
  },
};

/**
 * Navigation without pinned items.
 * My Items has no expand/collapse chevron.
 */
export const NoPinnedItems: Story = {
  args: {
    items: navItems,
    pinnedItems: [],
    username: "johndoe",
  },
};
