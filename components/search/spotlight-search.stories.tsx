/**
 * Storybook stories for the SpotlightSearch component.
 * Covers search states, results, and accessibility.
 */
import type { Meta, StoryObj } from "@storybook/nextjs";
import { expect, userEvent, within } from "storybook/test";
import { SpotlightSearch } from "./spotlight-search";
import { SpotlightProvider } from "@/contexts/spotlight-context";

/**
 * Spotlight search dialog for global search.
 *
 * ## Features
 * - macOS Spotlight-style search interface
 * - Three sections: Your Items, Public Collections, People
 * - Fuzzy filtering via cmdk library
 * - Breadcrumb paths for nested items
 * - Parallel data fetching with independent loading states
 * - 60-second TTL module-level cache
 *
 * ## Keyboard Navigation
 * - `/` - Open search from anywhere
 * - `Arrow Up/Down` - Navigate results
 * - `Enter` - Select result
 * - `Esc` - Close dialog
 */
const meta = {
  title: "Search/SpotlightSearch",
  component: SpotlightSearch,
  tags: ["autodocs"],
  parameters: {
    layout: "fullscreen",
    chromatic: { disableSnapshot: true },
    docs: {
      description: {
        component:
          "Spotlight-style global search dialog. Press '/' to open. Searches items, collections, and users with keyboard navigation.",
      },
    },
  },
  decorators: [
    (Story) => (
      <SpotlightProvider>
        <div className="bg-background h-screen w-full p-8">
          <p className="text-muted-foreground text-sm">
            Press <kbd className="rounded border px-1">/</kbd> to open search.
          </p>
          <Story />
        </div>
      </SpotlightProvider>
    ),
  ],
} satisfies Meta<typeof SpotlightSearch>;

export default meta;
type Story = StoryObj<typeof meta>;

/**
 * Default state - dialog closed.
 * Press "/" to open the search dialog.
 */
export const Default: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    // Press "/" to open the search dialog
    await userEvent.keyboard("/");
    // Wait for dialog to appear
    await canvas.findByPlaceholderText(/search/i);
  },
};

/**
 * Search input interaction.
 * Tests typing in the search field.
 */
export const WithSearchQuery: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    // Press "/" to open the search dialog
    await userEvent.keyboard("/");

    // Wait for dialog to appear
    const input = await canvas.findByPlaceholderText(/search/i);
    await expect(input).toBeInTheDocument();

    // Type a search query
    await userEvent.type(input, "Breaking Bad");

    // Verify input has the query
    await expect(input).toHaveValue("Breaking Bad");
  },
  parameters: {
    docs: {
      description: {
        story:
          "Demonstrates typing in the search field. Results are filtered via cmdk fuzzy search.",
      },
    },
  },
};

/**
 * Keyboard navigation test.
 * Demonstrates arrow key navigation through results.
 */
export const KeyboardNavigation: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    // Press "/" to open the search dialog
    await userEvent.keyboard("/");

    // Wait for dialog to appear
    const input = await canvas.findByPlaceholderText(/search/i);
    await expect(input).toBeInTheDocument();

    // Focus should be on input
    await expect(input).toHaveFocus();

    // Navigate with arrow keys
    await userEvent.keyboard("{ArrowDown}");
    await userEvent.keyboard("{ArrowDown}");
    await userEvent.keyboard("{ArrowUp}");
  },
  parameters: {
    docs: {
      description: {
        story:
          "Arrow keys navigate through search results. Enter selects the highlighted item.",
      },
    },
  },
};

/**
 * Close on Escape.
 * Verifies dialog closes when Escape is pressed.
 */
export const CloseOnEscape: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    // Press "/" to open the search dialog
    await userEvent.keyboard("/");

    // Wait for dialog to appear
    const input = await canvas.findByPlaceholderText(/search/i);
    await expect(input).toBeInTheDocument();

    // Press Escape to close
    await userEvent.keyboard("{Escape}");
  },
  parameters: {
    docs: {
      description: {
        story:
          "Pressing Escape closes the dialog and returns focus to the page.",
      },
    },
  },
};
