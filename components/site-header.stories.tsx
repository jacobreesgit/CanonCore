/**
 * Storybook stories for the SiteHeader component.
 * Covers breadcrumb navigation, context menu, and header states.
 */
import type { Meta, StoryObj } from "@storybook/nextjs";
import { fn, userEvent, within, expect } from "storybook/test";
import { SiteHeader } from "./site-header";
import { SidebarProvider, SidebarInset } from "@/components/ui/sidebar";

/**
 * Sticky header bar with breadcrumb navigation and context actions.
 *
 * ## Features
 * - Sidebar toggle button
 * - Breadcrumb navigation with truncation
 * - Theme toggle button
 * - Context menu for current item (rename, delete)
 * - Active state styling for current location
 *
 * ## Breadcrumb Hierarchy
 * Root title → Parent items → Current item (bold)
 */
const meta = {
  title: "Navigation/SiteHeader",
  component: SiteHeader,
  tags: ["autodocs"],
  parameters: {
    layout: "fullscreen",
    nextjs: {
      appDirectory: true,
    },
    docs: {
      story: { iframeHeight: "120px" },
      description: {
        component:
          "Sticky header bar with breadcrumb navigation and context actions. Supports sidebar toggle, theme switching, and item-specific actions via kebab menu.",
      },
    },
  },
  argTypes: {
    title: {
      control: "text",
      description: "Root title displayed at breadcrumb start",
    },
    titleHref: {
      control: "text",
      description: "Root href for the title link",
    },
    breadcrumbs: {
      description: "Array of breadcrumb items for navigation hierarchy",
    },
    currentItemId: {
      control: "text",
      description: "Current item ID (enables context menu)",
    },
    driveNeedsReauth: {
      control: "boolean",
      description:
        "Whether Google Drive needs reauthentication (shows reconnect banner)",
    },
    onRename: {
      description: "Callback when rename action is triggered",
    },
    onDelete: {
      description: "Callback when delete action is triggered",
    },
  },
  args: {
    onRename: fn(),
    onDelete: fn(),
  },
  decorators: [
    (Story) => (
      <SidebarProvider
        defaultOpen={true}
        style={{
          // Override min-h-svh from SidebarProvider for compact docs view
          minHeight: "auto",
        }}
      >
        <SidebarInset>
          <Story />
        </SidebarInset>
      </SidebarProvider>
    ),
  ],
} satisfies Meta<typeof SiteHeader>;

export default meta;
type Story = StoryObj<typeof meta>;

/**
 * Default header at root level.
 * No breadcrumbs, title is active.
 */
export const Default: Story = {
  args: {
    title: "My Items",
    titleHref: "/u/johndoe",
    breadcrumbs: [],
  },
};

/**
 * Single breadcrumb level.
 * One nested item.
 */
export const SingleBreadcrumb: Story = {
  args: {
    title: "My Items",
    titleHref: "/u/johndoe",
    breadcrumbs: [{ id: "1", name: "Movies", href: "/u/johndoe/1" }],
    currentItemId: "1",
  },
};

/**
 * Multiple breadcrumb levels.
 * Deep navigation hierarchy.
 */
export const MultipleBreadcrumbs: Story = {
  args: {
    title: "My Items",
    titleHref: "/u/johndoe",
    breadcrumbs: [
      { id: "1", name: "Movies", href: "/u/johndoe/1" },
      { id: "2", name: "Action", href: "/u/johndoe/2" },
      { id: "3", name: "Die Hard Collection", href: "/u/johndoe/3" },
    ],
    currentItemId: "3",
  },
};

/**
 * Long breadcrumb names.
 * Tests text truncation.
 */
export const LongBreadcrumbNames: Story = {
  args: {
    title: "My Items",
    titleHref: "/u/johndoe",
    breadcrumbs: [
      {
        id: "1",
        name: "My Favourite Action Movies Collection",
        href: "/u/johndoe/1",
      },
      {
        id: "2",
        name: "Award Winning Films from the 90s Era",
        href: "/u/johndoe/2",
      },
      {
        id: "3",
        name: "The Shawshank Redemption Extended Edition",
        href: "/u/johndoe/3",
      },
    ],
    currentItemId: "3",
  },
};

/**
 * With context menu open.
 * Shows kebab menu expanded with item actions.
 */
export const WithContextMenu: Story = {
  args: {
    title: "My Items",
    titleHref: "/u/johndoe",
    breadcrumbs: [{ id: "1", name: "Movies", href: "/u/johndoe/1" }],
    currentItemId: "1",
    onRename: fn(),
    onDelete: fn(),
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const menuButton = canvas.getByRole("button", { name: "Item actions" });
    await userEvent.click(menuButton);
  },
  parameters: {
    // Disable a11y checks - Radix dropdown menu portal renders outside main content
    a11y: { disable: true },
  },
};

/**
 * Drive reconnect banner visible.
 * Amber warning banner appears above breadcrumb row when Drive needs reauthentication.
 */
export const DriveReconnectBanner: Story = {
  args: {
    title: "My Items",
    titleHref: "/u/johndoe",
    breadcrumbs: [{ id: "1", name: "Movies", href: "/u/johndoe/1" }],
    driveNeedsReauth: true,
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const banner = canvas.getByTestId("drive-reconnect-banner");
    await expect(banner).toHaveAttribute("role", "alert");
    await expect(
      canvas.getByRole("button", { name: /reconnect/i })
    ).toBeInTheDocument();
  },
  parameters: {
    docs: {
      description: {
        story:
          "When Google Drive authentication expires, a glass-styled banner with amber icon appears above the breadcrumb row. The banner includes a Reconnect button that initiates the OAuth flow.",
      },
    },
  },
};

/**
 * Drive reconnect banner not shown.
 * Header renders normally when Drive is connected or not configured.
 */
export const NoDriveReconnectBanner: Story = {
  args: {
    title: "My Items",
    titleHref: "/u/johndoe",
    breadcrumbs: [{ id: "1", name: "Movies", href: "/u/johndoe/1" }],
    driveNeedsReauth: false,
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(
      canvas.queryByTestId("drive-reconnect-banner")
    ).not.toBeInTheDocument();
  },
  parameters: {
    docs: {
      description: {
        story:
          "When Drive is connected normally or not configured, no banner is shown. The header renders with only the breadcrumb row.",
      },
    },
  },
};
