/**
 * Storybook stories for the NavUser component.
 * Demonstrates user menu in sidebar footer with various states.
 */
import type { Meta, StoryObj } from "@storybook/nextjs";
import { NavUser } from "./nav-user";
import { SidebarProvider } from "@/components/ui/sidebar";
import type { GoogleDriveConnection } from "@/lib/types";

const meta = {
  title: "Navigation/NavUser",
  component: NavUser,
  tags: ["autodocs"],
  parameters: {
    layout: "centered",
    docs: {
      story: { iframeHeight: "100px" },
      description: {
        component:
          "User menu in sidebar footer. Shows avatar, name, email, and dropdown with storage bar, settings, and sign out.",
      },
    },
  },
  argTypes: {
    driveConnection: {
      control: false, // Contains BigInt values that cannot be serialized
      description: "Google Drive connection with storage quota",
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
        <div className="flex items-center justify-center py-2">
          <div className="w-[220px]">
            <Story />
          </div>
        </div>
      </SidebarProvider>
    ),
  ],
} satisfies Meta<typeof NavUser>;

export default meta;
type Story = StoryObj<typeof meta>;

const mockUser = {
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

export const Default: Story = {
  args: {
    user: mockUser,
    driveConnection: null,
  },
};

export const WithDriveConnection: Story = {
  args: {
    user: mockUser,
    driveConnection: mockDriveConnection,
  },
  parameters: {
    docs: {
      description: {
        story: "Shows storage bar in dropdown when Google Drive is connected.",
      },
    },
  },
};
