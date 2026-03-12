/**
 * Storybook stories for the MobileSearchSheet component.
 * Demonstrates mobile search bottom sheet with various states.
 */

import type { Meta, StoryObj } from "@storybook/nextjs";
import { fn } from "storybook/test";
import { useState } from "react";

import { MobileSearchSheet } from "./mobile-search-sheet";
import { Button } from "@/components/ui/button";

const meta = {
  title: "Mobile/MobileSearchSheet",
  component: MobileSearchSheet,
  tags: ["autodocs"],
  parameters: {
    layout: "fullscreen",
    viewport: { defaultViewport: "mobile1" },
    docs: {
      description: {
        component:
          "Mobile search bottom sheet containing Spotlight search UI. Reuses search logic with snap points for half and full screen views.",
      },
    },
  },
  argTypes: {
    open: {
      control: "boolean",
      description: "Whether the sheet is open",
    },
  },
  args: {
    open: false,
    onOpenChange: fn(),
  },
} satisfies Meta<typeof MobileSearchSheet>;

export default meta;
type Story = StoryObj<typeof meta>;

/**
 * Interactive wrapper that manages sheet state.
 */
function SheetWrapper() {
  const [open, setOpen] = useState(false);

  return (
    <div className="bg-background min-h-[400px] p-4">
      <Button onClick={() => setOpen(true)}>Open Search</Button>
      <MobileSearchSheet open={open} onOpenChange={setOpen} />
    </div>
  );
}

// === SEARCH STATES ===

export const Default: Story = {
  render: () => <SheetWrapper />,
  parameters: {
    docs: {
      description: {
        story:
          "Default search sheet. Opens at 50% height, expandable to 90%. Shows search input and result sections.",
      },
    },
  },
};

export const OpenState: Story = {
  args: {
    open: true,
  },
  parameters: {
    docs: {
      description: {
        story: "Sheet in open state for visual testing.",
      },
    },
  },
};

// Note: Loading, empty, and error states are handled internally by the
// Spotlight search components which fetch data on mount. These would
// require MSW mocking to demonstrate specific states in Storybook.
