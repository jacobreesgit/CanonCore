/**
 * Storybook stories for the AppSidebar component.
 * Covers sidebar states for different user types.
 */
import type { Meta, StoryObj } from "@storybook/nextjs";
import { AppSidebar } from "./app-sidebar";
import { SidebarProvider, SidebarInset } from "@/components/ui/sidebar";
import { SpotlightProvider } from "@/contexts/spotlight-context";
import type { GoogleDriveConnection } from "@/lib/types";

/**
 * Main application sidebar with consistent navigation.
 *
 * ## Features
 * - Logo and branding in header
 * - Main nav with My Items, Explore, Get Help, Legal
 * - Collapsible Get Help with doc section sub-items
 * - Collapsible Legal with policy sub-items
 * - User menu with settings and logout
 * - Guest buttons for unauthenticated users
 * - Collapsible on mobile (offcanvas mode)
 */
const meta = {
  title: "Navigation/AppSidebar",
  component: AppSidebar,
  tags: ["autodocs"],
  parameters: {
    layout: "fullscreen",
    docs: {
      description: {
        component:
          "Main application sidebar with consistent navigation. Includes collapsible Get Help and Legal sections with sub-items.",
      },
    },
    nextjs: {
      appDirectory: true,
      navigation: {
        pathname: "/u/johndoe",
      },
    },
  },
  argTypes: {
    user: {
      description: "Current user (null for guests)",
    },
    driveConnection: {
      control: false,
      description: "Google Drive connection (null if not connected)",
    },
    pinnedItems: {
      description: "Pinned items for sidebar (authenticated users only)",
    },
  },
  decorators: [
    (Story) => (
      <SpotlightProvider>
        <SidebarProvider defaultOpen={true}>
          <Story />
          <SidebarInset>
            <div className="flex h-screen items-center justify-center">
              <p className="text-muted-foreground">Main content area</p>
            </div>
          </SidebarInset>
        </SidebarProvider>
      </SpotlightProvider>
    ),
  ],
} satisfies Meta<typeof AppSidebar>;

export default meta;
type Story = StoryObj<typeof meta>;

const mockUser = {
  id: "user-123",
  name: "John Doe",
  email: "john@example.com",
  username: "johndoe",
  isPublic: true,
  hasImage: false,
  hasHeroImage: false,
};

const mockDriveConnection: GoogleDriveConnection = {
  email: "john@gmail.com",
  rootFolderId: "root-123",
  isActive: true,
  needsReauth: false,
  lastSyncAt: new Date(),
  lastError: null,
  quotaBytesUsed: BigInt(5_000_000_000),
  quotaBytesTotal: BigInt(15_000_000_000),
};

const mockPinnedItems = [
  { id: "item-1", name: "Movies", pinnedOrder: 0 },
  { id: "item-2", name: "TV Shows", pinnedOrder: 1 },
];

/**
 * Authenticated user with full navigation.
 * Shows My Items with pinned children, Get Help, Legal.
 */
export const Authenticated: Story = {
  args: {
    user: mockUser,
    driveConnection: mockDriveConnection,
    pinnedItems: mockPinnedItems,
  },
};

/**
 * Authenticated without Drive connection or pinned items.
 */
export const AuthenticatedNoDrive: Story = {
  args: {
    user: mockUser,
    driveConnection: null,
  },
};

/**
 * Guest user.
 * Shows Explore, Get Help, Legal, and sign-in buttons.
 */
export const Guest: Story = {
  args: {
    user: null,
    driveConnection: null,
  },
  parameters: {
    nextjs: {
      navigation: {
        pathname: "/",
      },
    },
  },
};

/**
 * User browsing docs.
 * Get Help section is active and expanded.
 */
export const OnDocsPage: Story = {
  args: {
    user: mockUser,
    driveConnection: null,
  },
  parameters: {
    nextjs: {
      navigation: {
        pathname: "/docs/getting-started/create-account",
      },
    },
  },
};
