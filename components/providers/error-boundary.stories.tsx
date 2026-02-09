/**
 * Storybook stories for the ErrorBoundary component.
 * Covers error states, fallback UI, and recovery actions.
 */
import type { Meta, StoryObj } from "@storybook/nextjs";
import { fn } from "storybook/test";
import { ErrorBoundary } from "./error-boundary";

/**
 * Error boundary component for graceful error handling.
 *
 * ## Features
 * - Catches JavaScript errors in child components
 * - Displays friendly error UI with retry option
 * - Supports custom fallback UI
 * - Logs errors to console with component stack
 * - Optional onError callback for error reporting
 */
const meta = {
  title: "Utilities/ErrorBoundary",
  component: ErrorBoundary,
  tags: ["autodocs"],
  parameters: {
    layout: "centered",
    docs: {
      description: {
        component:
          "React Error Boundary for graceful error handling. Catches JavaScript errors in child components and displays fallback UI with retry option.",
      },
    },
  },
  argTypes: {
    children: {
      description: "Child components to render and protect from errors",
      table: { category: "Content" },
    },
    fallback: {
      description: "Custom fallback UI to display when error occurs",
      table: { category: "Content" },
    },
    onError: {
      description: "Callback invoked when an error is caught",
      table: { category: "Events" },
    },
  },
  args: {
    onError: fn(),
  },
  decorators: [
    (Story) => (
      <div className="w-[400px]">
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof ErrorBoundary>;

export default meta;
type Story = StoryObj<typeof meta>;

// Component that throws an error
function BrokenComponent(): never {
  throw new Error("Test error for Storybook");
}

/**
 * Error state showing built-in error UI with retry button.
 */
export const Default: Story = {
  args: {
    children: <BrokenComponent />,
  },
};
