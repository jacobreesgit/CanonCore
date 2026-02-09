/**
 * Stories for UnderlineTabs component.
 * Minimal underline-style tab switcher with full ARIA support.
 */

import type { Meta, StoryObj } from "@storybook/nextjs";
import { userEvent, within, expect } from "storybook/test";
import { UnderlineTabs } from "./underline-tabs";

const meta = {
  title: "Items/Controls/UnderlineTabs",
  component: UnderlineTabs,
  tags: ["autodocs"],
  parameters: {
    layout: "fullscreen",
    docs: {
      description: {
        component:
          "Minimal underline-style tabs for switching between content sections. Supports keyboard navigation with arrow keys and full ARIA tab pattern. Used on item detail pages for About/Files tab switching.",
      },
    },
  },
} satisfies Meta<typeof UnderlineTabs>;

export default meta;
type Story = StoryObj<typeof meta>;

/** Two tabs — About and Files (typical item detail page). */
export const Default: Story = {
  args: {
    tabs: [
      {
        id: "about",
        label: "About",
        content: (
          <div className="text-muted-foreground p-8">
            <p>
              Cast, description, watch providers, videos, and recommendations
              from TMDB.
            </p>
          </div>
        ),
      },
      {
        id: "files",
        label: "Files",
        content: (
          <div className="text-muted-foreground p-8">
            <p>Media files, artwork, and subtitles attached to this item.</p>
          </div>
        ),
      },
    ],
    defaultTab: "about",
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const aboutTab = canvas.getByRole("tab", { name: "About" });
    const filesTab = canvas.getByRole("tab", { name: "Files" });

    await expect(aboutTab).toHaveAttribute("aria-selected", "true");
    await expect(filesTab).toHaveAttribute("aria-selected", "false");

    await userEvent.click(filesTab);
    await expect(filesTab).toHaveAttribute("aria-selected", "true");
    await expect(aboutTab).toHaveAttribute("aria-selected", "false");
  },
};

/** Three tabs — extended layout. */
export const ThreeTabs: Story = {
  args: {
    tabs: [
      {
        id: "about",
        label: "About",
        content: (
          <div className="text-muted-foreground p-8">
            <p>
              About this collection — metadata, description, and linked TMDB
              data.
            </p>
          </div>
        ),
      },
      {
        id: "files",
        label: "Files",
        content: (
          <div className="text-muted-foreground p-8">
            <p>3 media files, 2 artwork, 1 subtitle track.</p>
          </div>
        ),
      },
      {
        id: "activity",
        label: "Activity",
        content: (
          <div className="text-muted-foreground p-8">
            <p>Recent playback activity and sync history.</p>
          </div>
        ),
      },
    ],
  },
};

/** Keyboard navigation — use arrow keys to move between tabs. */
export const KeyboardNavigation: Story = {
  args: {
    tabs: [
      {
        id: "overview",
        label: "Overview",
        content: (
          <div className="text-muted-foreground p-8">Overview content</div>
        ),
      },
      {
        id: "details",
        label: "Details",
        content: (
          <div className="text-muted-foreground p-8">Details content</div>
        ),
      },
      {
        id: "related",
        label: "Related",
        content: (
          <div className="text-muted-foreground p-8">Related content</div>
        ),
      },
    ],
    defaultTab: "overview",
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const overviewTab = canvas.getByRole("tab", { name: "Overview" });

    // Focus first tab and navigate with arrow keys
    await userEvent.click(overviewTab);
    await userEvent.keyboard("{ArrowRight}");

    const detailsTab = canvas.getByRole("tab", { name: "Details" });
    await expect(detailsTab).toHaveAttribute("aria-selected", "true");

    await userEvent.keyboard("{ArrowRight}");
    const relatedTab = canvas.getByRole("tab", { name: "Related" });
    await expect(relatedTab).toHaveAttribute("aria-selected", "true");

    // Wraps around
    await userEvent.keyboard("{ArrowRight}");
    await expect(overviewTab).toHaveAttribute("aria-selected", "true");
  },
  parameters: {
    docs: {
      description: {
        story:
          "Arrow keys cycle through tabs. ArrowRight wraps from last to first, ArrowLeft wraps from first to last.",
      },
    },
  },
};
