/**
 * Storybook stories for the ProfileHero component.
 * Demonstrates profile hero with cover photos and avatars.
 */

import type { Meta, StoryObj } from "@storybook/nextjs";

import { ProfileHero } from "./profile-hero";
import type { PublicProfile } from "@/lib/public-auth";

const mockProfile: PublicProfile = {
  id: "user-123",
  username: "filmfan",
  name: "Film Fan",
  hasImage: false,
  hasHeroImage: false,
  createdAt: new Date("2024-01-15T10:00:00Z"),
};

const meta = {
  title: "Profile/ProfileHero",
  component: ProfileHero,
  tags: ["autodocs"],
  parameters: {
    layout: "fullscreen",
    docs: {
      description: {
        component:
          "Profile hero component with cover photo and avatar in Facebook-style layout. Features Framer Motion animations and reduced-motion support. Falls back to animated shader background when no cover image is set.",
      },
    },
  },
  argTypes: {
    profile: {
      description: "Profile data to display",
      table: { category: "Content" },
    },
    isOwnProfile: {
      control: "boolean",
      description: "Whether this is the current user's own profile",
      table: { category: "State" },
    },
    addContainerPadding: {
      control: "boolean",
      description: "Add responsive padding to hero container",
      table: { category: "Layout" },
    },
    className: {
      control: "text",
      description: "Additional CSS classes",
      table: { category: "Layout" },
    },
  },
} satisfies Meta<typeof ProfileHero>;

export default meta;
type Story = StoryObj<typeof meta>;

/**
 * Default profile hero without cover or avatar images.
 * Shows shader background and initial-based avatar.
 */
export const Default: Story = {
  args: {
    profile: mockProfile,
    isOwnProfile: false,
  },
  parameters: {
    docs: {
      description: {
        story:
          "Default state with shader background and initials avatar. Consistent colours are generated from username.",
      },
    },
  },
};

/**
 * Own profile view.
 * Shows when viewing your own profile (may include edit controls).
 */
export const OwnProfile: Story = {
  args: {
    profile: mockProfile,
    isOwnProfile: true,
  },
  parameters: {
    docs: {
      description: {
        story: "View when the current user is viewing their own profile.",
      },
    },
  },
};

/**
 * Profile with avatar image.
 * Shows custom profile picture instead of initials.
 */
export const WithAvatarImage: Story = {
  args: {
    profile: {
      ...mockProfile,
      hasImage: true,
    },
    isOwnProfile: false,
  },
  parameters: {
    docs: {
      description: {
        story:
          "Profile with a custom avatar image. Falls back to initials if image fails to load.",
      },
    },
  },
};

/**
 * Profile with hero/cover image.
 * Shows custom background instead of shader.
 */
export const WithHeroImage: Story = {
  args: {
    profile: {
      ...mockProfile,
      hasHeroImage: true,
    },
    isOwnProfile: false,
  },
  parameters: {
    docs: {
      description: {
        story: "Profile with a custom cover/hero image as background.",
      },
    },
  },
};

/**
 * Profile with both images.
 * Full customisation with avatar and cover.
 */
export const WithBothImages: Story = {
  args: {
    profile: {
      ...mockProfile,
      hasImage: true,
      hasHeroImage: true,
    },
    isOwnProfile: false,
  },
  parameters: {
    docs: {
      description: {
        story: "Fully customised profile with both avatar and cover images.",
      },
    },
  },
};

/**
 * Single name user.
 * Shows single initial in avatar.
 */
export const SingleNameUser: Story = {
  args: {
    profile: {
      ...mockProfile,
      name: "Madonna",
      username: "madonna",
    },
    isOwnProfile: false,
  },
  parameters: {
    docs: {
      description: {
        story: "User with a single-word name displays one initial.",
      },
    },
  },
};

/**
 * With container padding.
 * Shows responsive padding for profile pages.
 */
export const WithContainerPadding: Story = {
  args: {
    profile: mockProfile,
    isOwnProfile: false,
    addContainerPadding: true,
  },
  parameters: {
    docs: {
      description: {
        story: "Container padding variant for profile page layouts.",
      },
    },
  },
};

/**
 * Dark mode presentation.
 */
export const DarkMode: Story = {
  args: {
    profile: mockProfile,
    isOwnProfile: false,
  },
  parameters: {
    themes: {
      themeOverride: "dark",
    },
    backgrounds: {
      default: "dark",
    },
    docs: {
      description: {
        story: "Profile hero appearance in dark mode.",
      },
    },
  },
};
