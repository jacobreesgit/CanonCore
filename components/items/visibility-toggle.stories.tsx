/**
 * Storybook stories for the VisibilityToggle component.
 * Note: This component depends on server actions, so stories show static states.
 * Full interactivity requires mocking the server actions.
 */
import type { Meta, StoryObj } from "@storybook/nextjs";
import { fn } from "storybook/test";
import { VisibilityToggle } from "./visibility-toggle";

const meta = {
  title: "Items/Controls/VisibilityToggle",
  component: VisibilityToggle,
  tags: ["autodocs"],
  parameters: {
    layout: "padded",
    docs: {
      description: {
        component:
          "Toggle switch for item visibility with inheritance support. Shows warnings when changes affect child items.",
      },
    },
  },
  argTypes: {
    isPublic: { control: "boolean" },
    inheritVisibility: { control: "boolean" },
    hasParent: { control: "boolean" },
    hasChildren: { control: "boolean" },
  },
  args: {
    itemId: "item-123",
    itemName: "Breaking Bad",
    onVisibilityChange: fn(),
    onInheritChange: fn(),
  },
} satisfies Meta<typeof VisibilityToggle>;

export default meta;
type Story = StoryObj<typeof meta>;

// === STANDARD VARIANTS ===

export const Default: Story = {
  args: {
    isPublic: false,
    inheritVisibility: false,
    hasParent: false,
    hasChildren: false,
  },
};

export const PublicItem: Story = {
  args: {
    isPublic: true,
    inheritVisibility: false,
    hasParent: false,
    hasChildren: false,
  },
  parameters: {
    docs: {
      description: {
        story:
          "A public item shows a globe icon and indicates anyone with the link can view it.",
      },
    },
  },
};

export const WithParent: Story = {
  args: {
    isPublic: false,
    inheritVisibility: false,
    hasParent: true,
    hasChildren: false,
  },
  parameters: {
    docs: {
      description: {
        story:
          "Items with a parent show the inheritance toggle, allowing visibility to be inherited from the parent.",
      },
    },
  },
};

export const InheritingFromParent: Story = {
  args: {
    isPublic: true,
    inheritVisibility: true,
    hasParent: true,
    hasChildren: false,
  },
  parameters: {
    docs: {
      description: {
        story:
          "When inheriting, the visibility toggle is disabled and shows that visibility is controlled by the parent.",
      },
    },
  },
};

export const WithChildren: Story = {
  args: {
    isPublic: true,
    inheritVisibility: false,
    hasParent: false,
    hasChildren: true,
  },
  parameters: {
    docs: {
      description: {
        story:
          "Items with children will show a warning when making them private, as it affects child visibility.",
      },
    },
  },
};

export const NestedItemPublic: Story = {
  args: {
    isPublic: true,
    inheritVisibility: false,
    hasParent: true,
    hasChildren: true,
  },
  parameters: {
    docs: {
      description: {
        story:
          "A nested item with children shows both the inheritance toggle and visibility toggle.",
      },
    },
  },
};
