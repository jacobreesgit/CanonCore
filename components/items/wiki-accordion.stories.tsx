/**
 * Stories for WikiAccordion component.
 * Locked wiki sections placeholder with "Coming Soon" messaging.
 */

import type { Meta, StoryObj } from "@storybook/nextjs";
import { WikiAccordion } from "./wiki-accordion";

const meta = {
  title: "Items/About/WikiAccordion",
  component: WikiAccordion,
  tags: ["autodocs"],
  parameters: {
    layout: "centered",
    docs: {
      description: {
        component:
          "Locked wiki sections displayed as a placeholder for future MediaWiki integration. Each section shows a lock icon indicating content is coming soon.",
      },
    },
  },
  decorators: [
    (Story) => (
      <div className="w-[600px]">
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof WikiAccordion>;

export default meta;
type Story = StoryObj<typeof meta>;

/** Default (no sections prop) falls back to movie sections. */
export const Default: Story = {
  args: {},
};
