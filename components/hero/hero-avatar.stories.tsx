/**
 * Stories for HeroAvatar component.
 * Profile avatar with initials fallback and gradient background.
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
export const Default: Story = {
  args: {
    userId: "user-christopher-nolan",
    name: "Christopher Nolan",
    username: "nolan",
    hasImage: false,
  },
};
