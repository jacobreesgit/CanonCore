/**
 * Stories for WikiAccordion component.
 * Locked wiki sections placeholder with "Coming Soon" messaging.
 */

import type { Meta, StoryObj } from "@storybook/nextjs";
import { WikiAccordion } from "./wiki-accordion";
import {
  MOCK_WIKI_SECTIONS_MOVIE,
  MOCK_WIKI_SECTIONS_TV,
} from "@/lib/mock-data";

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

/** Movie wiki sections — Plot Summary, Production History, Critical Reception, Trivia. */
export const MovieSections: Story = {
  args: {
    sections: MOCK_WIKI_SECTIONS_MOVIE,
  },
  parameters: {
    docs: {
      description: {
        story:
          "Default movie sections: Plot Summary, Production History, Critical Reception, and Trivia & Facts.",
      },
    },
  },
};

/** TV show wiki sections — includes Episode Guide instead of Trivia. */
export const TVSections: Story = {
  args: {
    sections: MOCK_WIKI_SECTIONS_TV,
  },
  parameters: {
    docs: {
      description: {
        story:
          "TV show sections swap Trivia for Episode Guide and Critical Reception for Reception & Awards.",
      },
    },
  },
};

/** Default (no sections prop) falls back to movie sections. */
export const Default: Story = {
  args: {},
};
