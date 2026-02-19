/**
 * Stories for CardShell — shared visual base for card components.
 */

import type { Meta, StoryObj } from "@storybook/nextjs";
import { CardShell } from "./card-shell";

const meta = {
  title: "UI/CardShell",
  component: CardShell,
  tags: ["autodocs"],
  parameters: {
    layout: "centered",
    docs: {
      description: {
        component:
          "Shared visual shell for card components. Provides 2:3 aspect ratio, hover effects, and gradient overlays. Consumers handle interaction.",
      },
    },
  },
  decorators: [
    (Story) => (
      <div className="w-[180px]">
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof CardShell>;

export default meta;
type Story = StoryObj<typeof meta>;

/** Shell with image, title, and hover overlay. */
export const WithAllSlots: Story = {
  args: {
    children: (
      <div className="absolute inset-0 bg-gradient-to-br from-indigo-800 to-purple-900" />
    ),
    defaultContent: (
      <h3 className="truncate text-xs font-semibold text-white drop-shadow-lg md:text-sm">
        Item Title
      </h3>
    ),
    overlay: (
      <div>
        <h3 className="truncate text-xs font-semibold text-white md:text-sm">
          Item Title
        </h3>
        <p className="mt-1 line-clamp-2 text-xs text-white/60">
          Description text that might wrap to multiple lines.
        </p>
      </div>
    ),
  },
};

/** Shell with artwork only — no title or overlay. */
export const ArtworkOnly: Story = {
  args: {
    children: (
      <div className="absolute inset-0 bg-gradient-to-br from-emerald-800 to-teal-900" />
    ),
  },
};

/** Shell with fallback (no artwork). */
export const Fallback: Story = {
  args: {
    children: (
      <div className="from-card to-background flex size-full items-center justify-center bg-gradient-to-br">
        <span className="text-4xl font-bold text-white/20">F</span>
      </div>
    ),
    defaultContent: (
      <h3 className="truncate text-xs font-semibold text-white drop-shadow-lg md:text-sm">
        Fallback Item
      </h3>
    ),
  },
};
