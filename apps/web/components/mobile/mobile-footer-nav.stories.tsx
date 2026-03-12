/**
 * Storybook stories for the MobileFooterNav component.
 * Demonstrates mobile bottom navigation bar for different auth states.
 */

import type { Meta, StoryObj } from "@storybook/nextjs";
import { fn } from "storybook/test";

import {
  MobileFooterNav,
  getAuthenticatedFooterItems,
  getGuestFooterItems,
} from "./mobile-footer-nav";

const meta = {
  title: "Navigation/MobileFooterNav",
  component: MobileFooterNav,
  tags: ["autodocs"],
  parameters: {
    layout: "centered",
    docs: {
      description: {
        component:
          "Bottom navigation bar for mobile viewports. Supports navigation links and bottom sheet triggers with active state indication.",
      },
    },
  },
  args: {
    onSheetOpen: fn(),
    forceShow: true,
    className: "relative inset-auto w-[390px]",
  },
} satisfies Meta<typeof MobileFooterNav>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Authenticated: Story = {
  args: {
    items: getAuthenticatedFooterItems("johndoe"),
    userAvatar: "https://github.com/shadcn.png",
    userName: "John Doe",
  },
};

export const Guest: Story = {
  args: {
    items: getGuestFooterItems(),
  },
};
