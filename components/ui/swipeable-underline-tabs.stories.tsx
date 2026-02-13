/**
 * Storybook stories for the SwipeableUnderlineTabs component.
 * Demonstrates horizontal swipeable tab navigation with Embla Carousel,
 * using the cinematic underline tab bar style from item detail pages.
 */

import { useState } from "react";
import type { Meta, StoryObj } from "@storybook/nextjs";
import { fn, userEvent, within, expect } from "storybook/test";

import { SwipeableUnderlineTabs } from "./swipeable-underline-tabs";

/** Tab configuration matching SwipeableUnderlineTabs props. */
interface Tab {
  id: string;
  label: string;
  content: React.ReactNode;
}

/**
 * Wrapper component that manages active tab state internally.
 */
function SwipeableUnderlineTabsWithState({
  tabs,
  defaultTab,
  onTabChange,
  swipeEnabled,
  className,
}: {
  tabs: Tab[];
  defaultTab?: string;
  onTabChange?: (id: string) => void;
  swipeEnabled?: boolean;
  className?: string;
}) {
  const [activeTab, setActiveTab] = useState(defaultTab ?? tabs[0]?.id ?? "");

  return (
    <SwipeableUnderlineTabs
      tabs={tabs}
      activeTab={activeTab}
      onTabChange={(id) => {
        setActiveTab(id);
        onTabChange?.(id);
      }}
      swipeEnabled={swipeEnabled}
      className={className}
    />
  );
}

const contentsContent = (
  <div className="space-y-3 p-4">
    <h3 className="text-foreground text-sm font-medium">Contents</h3>
    <p className="text-muted-foreground text-sm">
      Child items appear here in tree or grid view. Drag-and-drop reordering is
      available in edit mode.
    </p>
    <div className="bg-muted/50 flex h-32 items-center justify-center rounded-lg">
      <span className="text-muted-foreground text-sm">
        Item grid placeholder
      </span>
    </div>
  </div>
);

const aboutContent = (
  <div className="space-y-3 p-4">
    <h3 className="text-foreground text-sm font-medium">About</h3>
    <p className="text-muted-foreground text-sm">
      TMDB metadata, cast, watch providers, videos, and recommendations appear
      here when linked to a movie or TV show.
    </p>
    <div className="bg-muted/50 flex h-48 items-center justify-center rounded-lg">
      <span className="text-muted-foreground text-sm">
        About tab placeholder
      </span>
    </div>
  </div>
);

const defaultTabs: Tab[] = [
  { id: "contents", label: "Contents", content: contentsContent },
  { id: "about", label: "About", content: aboutContent },
];

const meta = {
  title: "UI/SwipeableUnderlineTabs",
  component: SwipeableUnderlineTabsWithState,
  tags: ["autodocs"],
  parameters: {
    layout: "fullscreen",
    viewport: { defaultViewport: "mobile" },
    docs: {
      description: {
        component: `
Swipeable underline-style tabs for mobile item detail pages.

## Features

- **Swipe Navigation** - Embla Carousel handles touch/drag gestures with native-feeling physics
- **Cinematic Tab Bar** - Uppercase tracking with sliding indicator, matching the item detail page aesthetic
- **Lazy Content Rendering** - Unvisited tab content is not mounted until first visit, preserving scroll position once visited
- **Edit Mode Support** - \`swipeEnabled={false}\` disables drag gestures during dnd-kit reordering
- **Keyboard Navigation** - Arrow keys, Home/End with wrapping for full keyboard control
- **Reduced Motion** - Respects \`prefers-reduced-motion\` (instant transitions, no drag)
- **WCAG Accessible** - Proper tablist/tab/tabpanel roles, aria attributes, inert on off-screen panels, and aria-live announcements
- **Visible Focus** - \`focus-visible:ring-2\` on tab buttons (fixes pre-existing outline-none anti-pattern)
- **Sheet Compatible** - Uses \`data-vaul-no-drag\` to prevent Vaul sheet interference

Loaded via \`next/dynamic\` so Embla's bundle is only downloaded on mobile.
        `,
      },
    },
  },
  argTypes: {
    defaultTab: {
      control: "select",
      options: ["contents", "about"],
      description: "Initially active tab ID",
    },
    swipeEnabled: {
      control: "boolean",
      description:
        "Whether swipe gestures are active (set to false during edit mode)",
    },
  },
  args: {
    tabs: defaultTabs,
    defaultTab: "contents",
    onTabChange: fn(),
    swipeEnabled: true,
  },
} satisfies Meta<typeof SwipeableUnderlineTabsWithState>;

export default meta;
type Story = StoryObj<typeof meta>;

// === STANDARD VARIANTS ===

export const Default: Story = {
  args: {
    tabs: defaultTabs,
    defaultTab: "contents",
  },
  parameters: {
    docs: {
      description: {
        story:
          "Default state with Contents and About tabs. Contents tab is active. Swipe left to see About.",
      },
    },
  },
};

export const AboutTabActive: Story = {
  args: {
    tabs: defaultTabs,
    defaultTab: "about",
  },
  parameters: {
    docs: {
      description: {
        story:
          "Starts with the About tab active. Sliding indicator positions on the second tab.",
      },
    },
  },
};

export const SwipeDisabled: Story = {
  args: {
    tabs: defaultTabs,
    defaultTab: "contents",
    swipeEnabled: false,
  },
  parameters: {
    docs: {
      description: {
        story:
          "Swipe gestures disabled (edit mode). Tab clicks and keyboard navigation still work.",
      },
    },
  },
};

// === INTERACTION TESTS ===

export const TabClick: Story = {
  args: {
    tabs: defaultTabs,
    defaultTab: "contents",
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const aboutTab = canvas.getByRole("tab", { name: /about/i });
    await userEvent.click(aboutTab);
    await expect(aboutTab).toHaveAttribute("aria-selected", "true");
  },
  parameters: {
    docs: {
      description: {
        story:
          "Interaction test: clicking the About tab switches the active tab.",
      },
    },
  },
};

export const KeyboardNavigation: Story = {
  args: {
    tabs: defaultTabs,
    defaultTab: "contents",
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const contentsTab = canvas.getByRole("tab", { name: /contents/i });
    await userEvent.click(contentsTab);
    await userEvent.keyboard("{ArrowRight}");
    const aboutTab = canvas.getByRole("tab", { name: /about/i });
    await expect(aboutTab).toHaveAttribute("aria-selected", "true");
  },
  parameters: {
    docs: {
      description: {
        story:
          "Interaction test: ArrowRight moves focus and selection to the About tab.",
      },
    },
  },
};
