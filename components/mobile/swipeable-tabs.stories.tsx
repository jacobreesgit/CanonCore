/**
 * Storybook stories for the SwipeableTabs component.
 * Demonstrates horizontal swipeable tab navigation with Framer Motion gestures.
 */

import { useState } from "react";
import type { Meta, StoryObj } from "@storybook/nextjs";
import { fn, userEvent, within, expect } from "storybook/test";
import { Settings2, Film, Sparkles } from "lucide-react";

import { SwipeableTabs, type SwipeableTab } from "./swipeable-tabs";

/**
 * Wrapper component that manages active tab state internally.
 */
function SwipeableTabsWithState({
  tabs,
  defaultTab,
  onTabChange,
  className,
}: {
  tabs: SwipeableTab[];
  defaultTab?: string;
  onTabChange?: (id: string) => void;
  className?: string;
}) {
  const [activeTab, setActiveTab] = useState(defaultTab ?? tabs[0]?.id ?? "");

  return (
    <SwipeableTabs
      tabs={tabs}
      activeTab={activeTab}
      onTabChange={(id) => {
        setActiveTab(id);
        onTabChange?.(id);
      }}
      className={className}
    />
  );
}

const defaultTabs: SwipeableTab[] = [
  {
    id: "details",
    label: "Details",
    icon: Settings2,
    content: (
      <div className="space-y-3 p-2">
        <h3 className="text-foreground text-sm font-medium">Item Details</h3>
        <p className="text-muted-foreground text-sm">
          Edit item name, description, and visibility settings.
        </p>
      </div>
    ),
  },
  {
    id: "files",
    label: "Files",
    icon: Film,
    content: (
      <div className="space-y-3 p-2">
        <h3 className="text-foreground text-sm font-medium">File Management</h3>
        <p className="text-muted-foreground text-sm">
          Manage media files, artwork, and subtitles.
        </p>
      </div>
    ),
  },
  {
    id: "tmdb",
    label: "TMDB",
    icon: Sparkles,
    content: (
      <div className="space-y-3 p-2">
        <h3 className="text-foreground text-sm font-medium">TMDB Settings</h3>
        <p className="text-muted-foreground text-sm">
          Control which metadata sections are displayed.
        </p>
      </div>
    ),
  },
];

const meta = {
  title: "Mobile/SwipeableTabs",
  component: SwipeableTabsWithState,
  tags: ["autodocs"],
  parameters: {
    layout: "centered",
    viewport: { defaultViewport: "mobile" },
    docs: {
      description: {
        component: `
Horizontal swipeable tab component using Framer Motion gestures.

## Features

- **Swipe Navigation** - Drag left/right to switch tabs with spring physics
- **Sliding Indicator** - Animated underline follows the active tab
- **Keyboard Navigation** - Arrow keys, Home/End for full keyboard control
- **Reduced Motion** - Respects \`prefers-reduced-motion\` preference
- **WCAG Accessible** - Proper tablist/tab/tabpanel roles and aria attributes
- **Icon Support** - Optional Lucide icons in tab buttons
- **Sheet Compatible** - Uses \`data-vaul-no-drag\` to prevent Vaul sheet interference

        `,
      },
    },
  },
  argTypes: {
    defaultTab: {
      control: "select",
      options: ["details", "files", "tmdb"],
      description: "Initially active tab ID",
    },
  },
  args: {
    tabs: defaultTabs,
    defaultTab: "details",
    onTabChange: fn(),
  },
} satisfies Meta<typeof SwipeableTabsWithState>;

export default meta;
type Story = StoryObj<typeof meta>;

// === STANDARD VARIANTS ===

export const Default: Story = {
  args: {
    tabs: defaultTabs,
    defaultTab: "details",
  },
  parameters: {
    docs: {
      description: {
        story: "Default state with three tabs and icons. First tab is active.",
      },
    },
  },
};

export const TwoTabs: Story = {
  args: {
    tabs: defaultTabs.slice(0, 2),
    defaultTab: "details",
  },
  parameters: {
    docs: {
      description: {
        story:
          "Two-tab configuration (Details + Files). Common when no TMDB metadata is linked.",
      },
    },
  },
};

export const NoIcons: Story = {
  args: {
    tabs: defaultTabs.map((tab) => ({ ...tab, icon: undefined })),
    defaultTab: "details",
  },
  parameters: {
    docs: {
      description: {
        story: "Tabs without icons, showing label-only layout.",
      },
    },
  },
};

export const SecondTabActive: Story = {
  args: {
    tabs: defaultTabs,
    defaultTab: "files",
  },
  parameters: {
    docs: {
      description: {
        story:
          "Starts with the Files tab active. Sliding indicator positions on the second tab.",
      },
    },
  },
};

// === INTERACTION TESTS ===

export const TabClick: Story = {
  args: {
    tabs: defaultTabs,
    defaultTab: "details",
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const filesTab = canvas.getByRole("tab", { name: /files/i });
    await userEvent.click(filesTab);
    await expect(filesTab).toHaveAttribute("aria-selected", "true");
  },
  parameters: {
    docs: {
      description: {
        story:
          "Interaction test: clicking the Files tab switches the active tab.",
      },
    },
  },
};

export const KeyboardNavigation: Story = {
  args: {
    tabs: defaultTabs,
    defaultTab: "details",
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const detailsTab = canvas.getByRole("tab", { name: /details/i });
    await userEvent.click(detailsTab);
    await userEvent.keyboard("{ArrowRight}");
    const filesTab = canvas.getByRole("tab", { name: /files/i });
    await expect(filesTab).toHaveAttribute("aria-selected", "true");
  },
  parameters: {
    docs: {
      description: {
        story:
          "Interaction test: ArrowRight moves focus and selection to next tab.",
      },
    },
  },
};
