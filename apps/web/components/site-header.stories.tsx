/**
 * Storybook stories for the SiteHeader component.
 * Covers breadcrumb navigation and notification banners.
 */
import type { Meta, StoryObj } from "@storybook/nextjs";
import { within, expect } from "storybook/test";
import { SiteHeader } from "./site-header";
import { SidebarProvider, SidebarInset } from "@/components/ui/sidebar";

/**
 * Sticky header bar with breadcrumb navigation and notification banners.
 *
 * ## Features
 * - Sidebar toggle button
 * - Breadcrumb navigation with truncation
 * - Active state styling for current location
 * - Email verification and Drive reconnect banners
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
          "Sticky header bar with breadcrumb navigation and notification banners. Supports sidebar toggle and breadcrumb hierarchy.",
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
    emailUnverified: {
      control: "boolean",
      description:
        "Whether the user's email is unverified (shows verification banner)",
    },
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
  },
};

/**
 * Email verification banner visible.
 * Warning banner appears above breadcrumb row when user's email is unverified.
 */
export const EmailVerificationBanner: Story = {
  args: {
    title: "My Items",
    titleHref: "/u/johndoe",
    breadcrumbs: [{ id: "1", name: "Movies", href: "/u/johndoe/1" }],
    emailUnverified: true,
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const banner = canvas.getByRole("status");
    await expect(banner).toBeInTheDocument();
  },
  parameters: {
    docs: {
      description: {
        story:
          "When the user's email is unverified, a glass-styled banner appears above the breadcrumb row prompting the user to verify their email address.",
      },
    },
  },
};

/**
 * No verification banner shown.
 * Header renders normally when email is verified.
 */
export const NoVerificationBanner: Story = {
  args: {
    title: "My Items",
    titleHref: "/u/johndoe",
    breadcrumbs: [{ id: "1", name: "Movies", href: "/u/johndoe/1" }],
    emailUnverified: false,
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.queryByRole("status")).not.toBeInTheDocument();
  },
  parameters: {
    docs: {
      description: {
        story:
          "When the user's email is verified, no banner is shown. The header renders with only the breadcrumb row.",
      },
    },
  },
};
