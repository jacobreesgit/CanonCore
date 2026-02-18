/**
 * Storybook stories for the AppSidebar component.
 * Covers sidebar states for different contexts and user types.
 */
import type { Meta, StoryObj } from "@storybook/nextjs";
import type { Root as PageTreeRoot } from "fumadocs-core/page-tree";
import { AppSidebar } from "./app-sidebar";
import { SidebarProvider, SidebarInset } from "@/components/ui/sidebar";
import { SpotlightProvider } from "@/contexts/spotlight-context";
import type { GoogleDriveConnection } from "@/lib/types";

/**
 * Main application sidebar with context-aware navigation.
 *
 * ## Features
 * - Logo and branding in header
 * - Context-based content (my-items, docs, home)
 * - User menu with settings and logout
 * - Guest buttons for unauthenticated users
 * - Collapsible on mobile (offcanvas mode)
 *
 * ## Contexts
 * - **my-items**: Main nav with My Items, Explore
 * - **docs**: Documentation tree navigation
 * - **home**: Guest navigation without auth-specific items
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
          "Main application sidebar with context-aware navigation. Supports my-items, docs, and home contexts with user menu.",
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
    context: {
      control: "select",
      options: ["my-items", "docs", "home"],
      description: "Determines which navigation content to display",
    },
    user: {
      description: "Current user (null for guests)",
    },
    driveConnection: {
      control: false, // Contains BigInt values that cannot be serialized
      description: "Google Drive connection (null if not connected)",
    },
    docsTree: {
      description: "Fumadocs page tree for docs context",
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

const mockDocsTree: PageTreeRoot = {
  name: "Documentation",
  children: [
    { type: "page", name: "Introduction", url: "/docs" },
    { type: "page", name: "Getting Started", url: "/docs/getting-started" },
    { type: "separator", name: "Features" },
    {
      type: "folder",
      name: "Media Library",
      children: [
        {
          type: "page",
          name: "Adding Items",
          url: "/docs/media-library/adding",
        },
        {
          type: "page",
          name: "TMDB Integration",
          url: "/docs/media-library/tmdb",
        },
      ],
    },
    {
      type: "folder",
      name: "Google Drive",
      children: [
        {
          type: "page",
          name: "Connecting",
          url: "/docs/google-drive/connecting",
        },
        { type: "page", name: "Syncing", url: "/docs/google-drive/syncing" },
      ],
    },
  ],
};

/**
 * Authenticated user in my-items context.
 * Full navigation with user menu.
 */
export const AuthenticatedMyItems: Story = {
  args: {
    user: mockUser,
    context: "my-items",
    driveConnection: mockDriveConnection,
  },
};

/**
 * Authenticated without Drive connection.
 * No storage indicator in user menu.
 */
export const AuthenticatedNoDrive: Story = {
  args: {
    user: mockUser,
    context: "my-items",
    driveConnection: null,
  },
};

/**
 * Guest user in home context.
 * Shows Explore, Get Help, and Get Started.
 */
export const GuestHome: Story = {
  args: {
    user: null,
    context: "home",
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
 * Authenticated user in docs context.
 * Shows documentation tree navigation.
 */
export const AuthenticatedDocs: Story = {
  args: {
    user: mockUser,
    context: "docs",
    docsTree: mockDocsTree,
    driveConnection: null,
  },
  parameters: {
    nextjs: {
      navigation: {
        pathname: "/docs",
      },
    },
  },
};

/**
 * Guest user in docs context.
 * Shows docs tree with "Back to Home" link.
 */
export const GuestDocs: Story = {
  args: {
    user: null,
    context: "docs",
    docsTree: mockDocsTree,
    driveConnection: null,
  },
  parameters: {
    nextjs: {
      navigation: {
        pathname: "/docs",
      },
    },
  },
};
