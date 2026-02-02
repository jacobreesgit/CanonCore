/**
 * Storybook stories for the StorageBar component.
 * Covers storage states from empty to critical.
 */
import type { Meta, StoryObj } from "@storybook/nextjs";
import { StorageBar } from "./storage-bar";

/**
 * Storage usage bar for Google Drive quota display.
 *
 * ## Features
 * - Visual progress bar showing storage percentage
 * - Warning state at 80% usage (yellow)
 * - Critical state at 95% usage (red)
 * - Human-readable byte formatting (KB, MB, GB)
 * - Compact variant for space-constrained layouts
 * - Accessible with ARIA labels
 */
const meta = {
  title: "Google Drive/StorageBar",
  component: StorageBar,
  tags: ["autodocs"],
  parameters: {
    layout: "centered",
    docs: {
      description: {
        component:
          "Storage usage bar for Google Drive quota. Shows visual progress with warning (80%) and critical (95%) states.",
      },
    },
  },
  argTypes: {
    bytesUsed: {
      control: false, // BigInt cannot be serialized by Storybook controls
      description: "Bytes currently used (BigInt)",
      table: { type: { summary: "bigint | null" } },
    },
    bytesTotal: {
      control: false, // BigInt cannot be serialized by Storybook controls
      description: "Total bytes available (BigInt)",
      table: { type: { summary: "bigint | null" } },
    },
    variant: {
      control: "radio",
      options: ["default", "compact"],
      description: "Display variant",
    },
    className: {
      control: "text",
      description: "Additional CSS classes",
    },
  },
  decorators: [
    (Story) => (
      <div className="w-80">
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof StorageBar>;

export default meta;
type Story = StoryObj<typeof meta>;

// Helper constants for storage sizes (use integers to avoid BigInt conversion errors)
const GB = 1024 * 1024 * 1024;
const TOTAL_15GB = BigInt(15 * GB);

/**
 * Default state with moderate usage (50%).
 */
export const Default: Story = {
  args: {
    bytesUsed: BigInt(Math.floor(7.5 * GB)), // 7.5 GB
    bytesTotal: TOTAL_15GB,
    variant: "default",
  },
};

/**
 * Warning state (80% used).
 * Shows yellow progress bar and warning text.
 */
export const Warning: Story = {
  args: {
    bytesUsed: BigInt(12 * GB), // 12 GB
    bytesTotal: TOTAL_15GB,
    variant: "default",
  },
};

/**
 * Critical state (95%+ used).
 * Shows red progress bar and critical warning.
 */
export const Critical: Story = {
  args: {
    bytesUsed: BigInt(Math.floor(14.5 * GB)), // 14.5 GB
    bytesTotal: TOTAL_15GB,
    variant: "default",
  },
};

/**
 * Compact variant (bar only).
 * For space-constrained layouts.
 */
export const Compact: Story = {
  args: {
    bytesUsed: BigInt(Math.floor(7.5 * GB)),
    bytesTotal: TOTAL_15GB,
    variant: "compact",
  },
};
