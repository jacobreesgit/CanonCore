/**
 * Stories for PreferencesTab component.
 * User preferences form for view mode and sort order.
 */

import type { Meta, StoryObj } from "@storybook/nextjs";
import { PreferencesTab } from "./preferences-tab";

const meta = {
  title: "Profile/PreferencesTab",
  component: PreferencesTab,
  tags: ["autodocs"],
  parameters: {
    layout: "centered",
    docs: {
      description: {
        component:
          "Preferences tab content for the settings dialog. Loads view mode and sort preferences from the server and saves changes immediately with optimistic updates. Uses radio buttons for view mode (grid/tree) and a select dropdown for default sort order.",
      },
    },
  },
  decorators: [
    (Story) => (
      <div className="w-[400px] rounded-xl border border-white/10 bg-white/5 p-6">
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof PreferencesTab>;

export default meta;
type Story = StoryObj<typeof meta>;

/** Default state — loads preferences from mocked server action. */
export const Default: Story = {};
