/**
 * Storybook stories for the MeshGradient background.
 * Shows all three variations used across the app.
 */
import type { Meta, StoryObj } from "@storybook/nextjs";
import { MeshGradient } from "@mesh-gradient/react";

const meta = {
  title: "Homepage/MeshGradientBackground",
  component: MeshGradient,
  tags: ["autodocs"],
  parameters: {
    layout: "fullscreen",
    docs: {
      description: {
        component:
          "Animated WebGL mesh gradient background using @mesh-gradient/react. Three distinct palettes for homepage, cinematic hero fallback, and media player contexts.",
      },
    },
  },
  decorators: [
    (Story) => (
      <div className="relative h-[500px] w-full overflow-hidden">
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof MeshGradient>;

export default meta;
type Story = StoryObj<typeof meta>;

/**
 * Bold purple/violet palette used on the homepage hero.
 */
export const Homepage: Story = {
  args: {
    className: "absolute inset-0 h-full w-full",
    options: {
      colors: ["#0f0c29", "#302b63", "#24243e", "#6b21a8"],
      animationSpeed: 0.4,
      seed: 5,
    },
  },
};

/**
 * Deep navy/midnight palette used as CinematicHero fallback
 * when slides have no artwork.
 */
export const CinematicHero: Story = {
  args: {
    className: "absolute inset-0 h-full w-full",
    options: {
      colors: ["#0a0a0a", "#1a1a2e", "#16213e", "#0f3460"],
      animationSpeed: 0.2,
      seed: 7,
    },
  },
};

/**
 * Near-black ambient palette used as media player background
 * for audio files without artwork.
 */
export const MediaPlayer: Story = {
  args: {
    className: "absolute inset-0 h-full w-full",
    options: {
      colors: ["#0d0d0d", "#1a0a1e", "#0a1628", "#1e1e2e"],
      animationSpeed: 0.15,
      seed: 19,
    },
  },
};
