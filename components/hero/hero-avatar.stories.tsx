/**
 * Stories for HeroAvatar component.
 * Profile avatar with image loading, skeleton, and initials fallback.
 */

import type { Meta, StoryObj } from "@storybook/nextjs";
import { HeroAvatar } from "./hero-avatar";

const meta = {
  title: "Layout/HeroAvatar",
  component: HeroAvatar,
  tags: ["autodocs"],
  parameters: {
    layout: "centered",
    docs: {
      description: {
        component:
          "Profile avatar used in the CinematicHero. Displays user image with skeleton loading state, or falls back to initials with a gradient background derived from the user ID.",
      },
    },
  },
} satisfies Meta<typeof HeroAvatar>;

export default meta;
type Story = StoryObj<typeof meta>;

/** Initials fallback with gradient (no uploaded image). */
export const InitialsFallback: Story = {
  args: {
    userId: "user-christopher-nolan",
    name: "Christopher Nolan",
    username: "nolan",
    hasImage: false,
  },
  parameters: {
    docs: {
      description: {
        story:
          "When the user has no uploaded image, displays initials over a deterministic gradient derived from their user ID.",
      },
    },
  },
};

/** Single-name user shows first letter only. */
export const SingleName: Story = {
  args: {
    userId: "user-spielberg",
    name: "Spielberg",
    username: "spielberg",
    hasImage: false,
  },
};

/** Username fallback when name is null. */
export const NoName: Story = {
  args: {
    userId: "user-kubrick",
    name: null,
    username: "kubrick",
    hasImage: false,
  },
  parameters: {
    docs: {
      description: {
        story:
          "When name is null, uses the first letter of the username for the initials display.",
      },
    },
  },
};

/** With image — shows loading skeleton then image (will show error fallback in Storybook since API is mocked). */
export const WithImage: Story = {
  args: {
    userId: "user-tarantino",
    name: "Quentin Tarantino",
    username: "tarantino",
    hasImage: true,
  },
  parameters: {
    docs: {
      description: {
        story:
          "When the user has an uploaded image, shows a skeleton while loading. Falls back to initials if the image fails to load.",
      },
    },
  },
};

/** Different gradient per user ID. */
export const DifferentGradients: Story = {
  args: {
    userId: "user-1",
    name: "Martin Scorsese",
    username: "scorsese",
    hasImage: false,
  },
  render: () => (
    <div className="flex gap-6">
      <HeroAvatar
        userId="user-1"
        name="Martin Scorsese"
        username="scorsese"
        hasImage={false}
      />
      <HeroAvatar
        userId="user-2"
        name="Denis Villeneuve"
        username="villeneuve"
        hasImage={false}
      />
      <HeroAvatar
        userId="user-3"
        name="Greta Gerwig"
        username="gerwig"
        hasImage={false}
      />
      <HeroAvatar
        userId="user-4"
        name="Bong Joon-ho"
        username="bong"
        hasImage={false}
      />
    </div>
  ),
  parameters: {
    docs: {
      description: {
        story:
          "Each user ID produces a unique gradient, ensuring visual distinction across profiles.",
      },
    },
  },
};
