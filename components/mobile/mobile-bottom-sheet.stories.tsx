/**
 * Storybook stories for the MobileBottomSheet component.
 * Demonstrates base bottom sheet behavior with various configurations.
 */

import type { Meta, StoryObj } from "@storybook/nextjs";
import { fn } from "storybook/test";
import { useState } from "react";

import {
  MobileBottomSheet,
  MobileBottomSheetContent,
  MobileBottomSheetFooter,
  MobileBottomSheetHeader,
  MobileBottomSheetTitle,
} from "./mobile-bottom-sheet";
import { Button } from "@/components/ui/button";

const meta = {
  title: "Mobile/MobileBottomSheet",
  component: MobileBottomSheet,
  tags: ["autodocs"],
  parameters: {
    layout: "fullscreen",
    viewport: { defaultViewport: "mobile1" },
    docs: {
      description: {
        component:
          "Base bottom sheet component wrapping Vaul drawer. Provides consistent mobile sheet behavior with spring animations, handle indicator, and safe area support.",
      },
    },
  },
  argTypes: {
    open: {
      control: "boolean",
      description: "Whether the sheet is open",
    },
    snapPoints: {
      control: false,
      description: "Snap points for sheet height",
    },
    repositionInputs: {
      control: "boolean",
      description: "Auto-expand when keyboard opens",
    },
    title: {
      control: "text",
      description: "Accessible title for screen readers (required)",
    },
    description: {
      control: "text",
      description: "Optional description for screen readers",
    },
  },
  args: {
    open: false,
    onOpenChange: fn(),
    onAnimationEnd: fn(),
    children: null,
    title: "Bottom Sheet",
  },
} satisfies Meta<typeof MobileBottomSheet>;

export default meta;
type Story = StoryObj<typeof meta>;

/**
 * Interactive wrapper that manages sheet state.
 */
function SheetWrapper({
  children,
  ...props
}: Omit<
  React.ComponentProps<typeof MobileBottomSheet>,
  "open" | "onOpenChange"
>) {
  const [open, setOpen] = useState(false);

  return (
    <div className="bg-background min-h-[400px] p-4">
      <Button onClick={() => setOpen(true)}>Open Sheet</Button>
      <MobileBottomSheet open={open} onOpenChange={setOpen} {...props}>
        {children}
      </MobileBottomSheet>
    </div>
  );
}

// === BASIC CONFIGURATIONS ===

export const Default: Story = {
  render: (args) => (
    <SheetWrapper {...args}>
      <MobileBottomSheetContent>
        <p className="text-muted-foreground">
          This is the default bottom sheet with auto height.
        </p>
      </MobileBottomSheetContent>
    </SheetWrapper>
  ),
  args: {
    title: "Default Sheet",
    description: "A basic bottom sheet example",
    snapPoints: ["auto"],
  },
};

export const WithHeader: Story = {
  render: (args) => (
    <SheetWrapper {...args}>
      <MobileBottomSheetHeader>
        <MobileBottomSheetTitle>Sheet Title</MobileBottomSheetTitle>
        <p className="text-muted-foreground text-sm">
          Subtitle or description text
        </p>
      </MobileBottomSheetHeader>
      <MobileBottomSheetContent>
        <p>Content goes here with proper padding and scroll support.</p>
      </MobileBottomSheetContent>
    </SheetWrapper>
  ),
  args: {
    title: "Sheet with Header",
    snapPoints: ["auto"],
  },
  parameters: {
    docs: {
      description: {
        story: "Sheet with visible header title and description.",
      },
    },
  },
};

export const WithFooter: Story = {
  render: (args) => (
    <SheetWrapper {...args}>
      <MobileBottomSheetContent>
        <p className="text-muted-foreground">
          Sheet content with action buttons in the footer.
        </p>
      </MobileBottomSheetContent>
      <MobileBottomSheetFooter>
        <Button variant="outline" className="w-full">
          Cancel
        </Button>
        <Button className="w-full">Confirm</Button>
      </MobileBottomSheetFooter>
    </SheetWrapper>
  ),
  args: {
    title: "Sheet with Footer",
    snapPoints: ["auto"],
  },
  parameters: {
    docs: {
      description: {
        story: "Sheet with footer containing action buttons.",
      },
    },
  },
};

export const FullLayout: Story = {
  render: (args) => (
    <SheetWrapper {...args}>
      <MobileBottomSheetHeader>
        <MobileBottomSheetTitle>Complete Layout</MobileBottomSheetTitle>
        <p className="text-muted-foreground text-sm">
          Header, content, and footer sections
        </p>
      </MobileBottomSheetHeader>
      <MobileBottomSheetContent>
        <div className="space-y-4">
          <p>This sheet demonstrates all layout sections working together.</p>
          <p>The content area scrolls independently when it overflows.</p>
          <p>Safe area insets are handled automatically for notched devices.</p>
        </div>
      </MobileBottomSheetContent>
      <MobileBottomSheetFooter>
        <Button className="w-full">Primary Action</Button>
      </MobileBottomSheetFooter>
    </SheetWrapper>
  ),
  args: {
    title: "Full Layout Sheet",
    snapPoints: ["auto"],
  },
  parameters: {
    docs: {
      description: {
        story: "Complete sheet with header, scrollable content, and footer.",
      },
    },
  },
};

// === SNAP POINTS ===

export const SnapPointsHalfFull: Story = {
  render: (args) => (
    <SheetWrapper {...args}>
      <MobileBottomSheetContent>
        <div className="space-y-4">
          <p className="font-medium">Snap Points: 50% and 90%</p>
          <p className="text-muted-foreground text-sm">
            Drag the sheet up or down to snap between different heights.
          </p>
          {Array.from({ length: 10 }).map((_, i) => (
            <p key={i} className="text-sm">
              Content line {i + 1} - scroll or drag to interact
            </p>
          ))}
        </div>
      </MobileBottomSheetContent>
    </SheetWrapper>
  ),
  args: {
    title: "Multi-Snap Sheet",
    snapPoints: ["50%", "90%"],
  },
  parameters: {
    docs: {
      description: {
        story: "Sheet with multiple snap points for different content states.",
      },
    },
  },
};

export const FixedHeight: Story = {
  render: (args) => (
    <SheetWrapper {...args}>
      <MobileBottomSheetContent>
        <p className="text-muted-foreground">
          This sheet has a fixed 300px height snap point.
        </p>
      </MobileBottomSheetContent>
    </SheetWrapper>
  ),
  args: {
    title: "Fixed Height Sheet",
    snapPoints: [300],
  },
  parameters: {
    docs: {
      description: {
        story: "Sheet with a fixed pixel height snap point.",
      },
    },
  },
};

// === SCROLLABLE CONTENT ===

export const ScrollableContent: Story = {
  render: (args) => (
    <SheetWrapper {...args}>
      <MobileBottomSheetHeader>
        <MobileBottomSheetTitle>Scrollable Content</MobileBottomSheetTitle>
      </MobileBottomSheetHeader>
      <MobileBottomSheetContent>
        <div className="space-y-4">
          {Array.from({ length: 20 }).map((_, i) => (
            <div key={i} className="rounded-lg border p-4">
              <p className="font-medium">Item {i + 1}</p>
              <p className="text-muted-foreground text-sm">
                Description for item {i + 1}
              </p>
            </div>
          ))}
        </div>
      </MobileBottomSheetContent>
    </SheetWrapper>
  ),
  args: {
    title: "Scrollable Sheet",
    snapPoints: ["70%"],
  },
  parameters: {
    docs: {
      description: {
        story:
          "Sheet with scrollable content using data-vaul-no-drag to prevent dismiss while scrolling.",
      },
    },
  },
};

// === INPUT HANDLING ===

export const WithInputs: Story = {
  render: (args) => (
    <SheetWrapper {...args}>
      <MobileBottomSheetHeader>
        <MobileBottomSheetTitle>Form Sheet</MobileBottomSheetTitle>
      </MobileBottomSheetHeader>
      <MobileBottomSheetContent>
        <div className="space-y-4">
          <div>
            <label htmlFor="name" className="text-sm font-medium">
              Name
            </label>
            <input
              id="name"
              type="text"
              className="mt-1 w-full rounded-md border px-3 py-2"
              placeholder="Enter your name"
            />
          </div>
          <div>
            <label htmlFor="email" className="text-sm font-medium">
              Email
            </label>
            <input
              id="email"
              type="email"
              className="mt-1 w-full rounded-md border px-3 py-2"
              placeholder="Enter your email"
            />
          </div>
        </div>
      </MobileBottomSheetContent>
      <MobileBottomSheetFooter>
        <Button className="w-full">Submit</Button>
      </MobileBottomSheetFooter>
    </SheetWrapper>
  ),
  args: {
    title: "Form Sheet",
    snapPoints: ["auto"],
    repositionInputs: true,
  },
  parameters: {
    docs: {
      description: {
        story:
          "Sheet with form inputs. Uses repositionInputs to auto-expand when keyboard opens.",
      },
    },
  },
};
