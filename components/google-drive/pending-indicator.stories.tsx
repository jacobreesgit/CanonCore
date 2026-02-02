/**
 * Storybook stories for the PendingIndicator component.
 * Demonstrates pending sync operation count display.
 */

import type { Meta, StoryObj } from "@storybook/nextjs";

import { PendingIndicator } from "./pending-indicator";

/**
 * Mock component that renders a static version of the indicator.
 * The real component relies on async IndexedDB operations which can't
 * be easily mocked in Storybook, so we create a visual-only variant.
 */
function MockPendingIndicator({ count }: { count: number }) {
  if (count === 0) return null;

  return (
    <div
      data-pending-indicator
      className="inline-flex items-center gap-1.5 rounded-full border border-amber-500/20 bg-amber-500/10 px-2.5 py-1 text-xs font-medium text-amber-600 dark:text-amber-400"
    >
      <div className="relative flex size-3 items-center justify-center">
        <svg
          xmlns="http://www.w3.org/2000/svg"
          width="12"
          height="12"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M20.24 12.24a6 6 0 0 0-8.49-8.49L5 10.5V19h8.5z" />
          <line x1="16" y1="8" x2="2" y2="22" />
          <line x1="17.5" y1="15" x2="9" y2="15" />
        </svg>
      </div>
      <span className="tabular-nums">{count}</span>
      <span className="text-amber-600/70 dark:text-amber-400/70">pending</span>
    </div>
  );
}

const meta = {
  title: "Google Drive/PendingIndicator",
  component: PendingIndicator,
  tags: ["autodocs"],
  parameters: {
    layout: "centered",
    docs: {
      description: {
        component:
          "Shows count of pending sync operations waiting to be processed. Hidden when queue is empty or unavailable. Useful for offline-first sync feedback.",
      },
    },
  },
  decorators: [
    (Story) => (
      <div className="flex items-center gap-4 p-4">
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof PendingIndicator>;

export default meta;
type Story = StoryObj<typeof meta>;

// NOTE: PendingIndicator relies on IndexedDB async operations that can't be
// easily mocked in Storybook. Stories use a mock component for visual states.

export const Default: Story = {
  render: () => <MockPendingIndicator count={1} />,
  parameters: {
    docs: {
      description: {
        story: "Shows indicator with 1 pending operation.",
      },
    },
  },
};

export const MultiplePending: StoryObj<{ count: number }> = {
  render: () => <MockPendingIndicator count={5} />,
  parameters: {
    docs: {
      description: {
        story: "Shows indicator with multiple pending operations.",
      },
    },
  },
};

export const ManyPending: StoryObj<{ count: number }> = {
  render: () => <MockPendingIndicator count={47} />,
  parameters: {
    docs: {
      description: {
        story: "Shows indicator with many pending operations (batch sync).",
      },
    },
  },
};

export const MaxPending: StoryObj<{ count: number }> = {
  render: () => <MockPendingIndicator count={100} />,
  parameters: {
    docs: {
      description: {
        story: "Shows indicator at maximum queue capacity (100 operations).",
      },
    },
  },
};
