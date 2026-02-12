/**
 * Storybook stories for the SwipeableTabs component.
 * Demonstrates horizontal swipeable tab navigation with Framer Motion gestures,
 * and Select dropdown fallback for >3 tabs.
 */

import { useState } from "react";
import type { Meta, StoryObj } from "@storybook/nextjs";
import { fn, userEvent, within, expect } from "storybook/test";
import {
  Settings2,
  Film,
  Sparkles,
  User,
  Lock,
  Cloud,
  SlidersHorizontal,
  List,
} from "lucide-react";

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
- **Select Fallback** - Automatically switches to a dropdown when >3 tabs
- **Reduced Motion** - Respects \`prefers-reduced-motion\` preference
- **WCAG Accessible** - Proper tablist/tab/tabpanel roles and aria attributes
- **Icon Support** - Optional Lucide icons in tab buttons and Select items
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

// === SELECT MODE (>3 TABS) ===

const fiveTabsData: SwipeableTab[] = [
  {
    id: "profile",
    label: "Profile",
    icon: User,
    content: (
      <div className="space-y-3 p-2">
        <h3 className="text-foreground text-sm font-medium">Profile</h3>
        <p className="text-muted-foreground text-sm">
          Manage your display name, avatar, and public profile settings.
        </p>
      </div>
    ),
  },
  {
    id: "account",
    label: "Account",
    icon: Lock,
    content: (
      <div className="space-y-3 p-2">
        <h3 className="text-foreground text-sm font-medium">Account</h3>
        <p className="text-muted-foreground text-sm">
          Change password, email, or username.
        </p>
      </div>
    ),
  },
  {
    id: "connections",
    label: "Connections",
    icon: Cloud,
    content: (
      <div className="space-y-3 p-2">
        <h3 className="text-foreground text-sm font-medium">Connections</h3>
        <p className="text-muted-foreground text-sm">
          Connect or disconnect Google Drive.
        </p>
      </div>
    ),
  },
  {
    id: "preferences",
    label: "Preferences",
    icon: SlidersHorizontal,
    content: (
      <div className="space-y-3 p-2">
        <h3 className="text-foreground text-sm font-medium">Preferences</h3>
        <p className="text-muted-foreground text-sm">
          Set default view mode and sort order.
        </p>
      </div>
    ),
  },
  {
    id: "activity",
    label: "Activity",
    icon: List,
    content: (
      <div className="space-y-3 p-2">
        <h3 className="text-foreground text-sm font-medium">Activity</h3>
        <p className="text-muted-foreground text-sm">
          View sync history and recent operations.
        </p>
      </div>
    ),
  },
];

const fourTabsData: SwipeableTab[] = fiveTabsData.slice(0, 4);

export const FiveTabsSelect: Story = {
  args: {
    tabs: fiveTabsData,
    defaultTab: "profile",
  },
  parameters: {
    docs: {
      description: {
        story:
          "Five tabs trigger Select dropdown mode. Mirrors MobileSettingsSheet layout with full-length labels.",
      },
    },
  },
};

export const FourTabsSelect: Story = {
  args: {
    tabs: fourTabsData,
    defaultTab: "profile",
  },
  parameters: {
    docs: {
      description: {
        story: "Boundary case: 4 tabs triggers Select mode (threshold is >3).",
      },
    },
  },
};

export const ThreeTabsSwipeable: Story = {
  args: {
    tabs: defaultTabs,
    defaultTab: "details",
  },
  parameters: {
    docs: {
      description: {
        story:
          "Explicit boundary: 3 tabs stays in swipeable mode with tab bar and drag gestures.",
      },
    },
  },
};

// === SELECT MODE INTERACTION TESTS ===

export const SelectDropdownClick: Story = {
  args: {
    tabs: fiveTabsData,
    defaultTab: "profile",
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const trigger = canvas.getByRole("combobox");
    await expect(trigger).toHaveTextContent("Profile");

    // Open the dropdown
    await userEvent.click(trigger);

    // Select a different tab via the dropdown
    const body = within(document.body);
    const accountOption = body.getByRole("option", { name: /Account/i });
    await userEvent.click(accountOption);

    // Verify the trigger now shows Account
    await expect(trigger).toHaveTextContent("Account");
  },
  parameters: {
    docs: {
      description: {
        story:
          "Interaction test: opening the Select dropdown and choosing a tab in Select mode.",
      },
    },
  },
};
