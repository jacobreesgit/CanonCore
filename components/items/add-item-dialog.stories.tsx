/**
 * Storybook stories for the AddItemDialog component.
 * Demonstrates the multi-step item creation flow with TMDB integration.
 */

import { useState } from "react";
import type { Meta, StoryObj } from "@storybook/nextjs";
import { expect, fn, userEvent, waitFor, within } from "storybook/test";

import { Button } from "@/components/ui/button";
import { AddItemDialog } from "./add-item-dialog";

/**
 * Wrapper component that provides a trigger button for the dialog.
 * This pattern allows dialogs to work properly in Storybook autodocs.
 */
function DialogWithTrigger(
  props: Omit<
    React.ComponentProps<typeof AddItemDialog>,
    "open" | "onOpenChange"
  > & {
    buttonLabel?: string;
  }
) {
  const [open, setOpen] = useState(false);
  const { buttonLabel = "Open Dialog", ...dialogProps } = props;

  return (
    <>
      <Button onClick={() => setOpen(true)} data-testid="dialog-trigger">
        {buttonLabel}
      </Button>
      <AddItemDialog {...dialogProps} open={open} onOpenChange={setOpen} />
    </>
  );
}

const meta = {
  title: "Items/Dialogs/AddItemDialog",
  component: DialogWithTrigger,
  tags: ["autodocs"],
  parameters: {
    layout: "centered",
    docs: {
      description: {
        component: `
Multi-step dialog for creating new items with optional TMDB metadata lookup.

## Features

- **Manual Entry** - Enter name and description directly
- **TMDB Search** - Search for movies/TV shows to auto-fill metadata
- **TV Episode Picker** - Navigate shows to select specific seasons or episodes
- **File Uploads** - Queue media, artwork, and subtitle files (requires Drive connection)
- **Upload Progress** - Real-time progress tracking with retry support

## Step Flow

1. **Main** - Details tab (name, description) and Files tab (if Drive connected)
2. **Episode Picker** - TV show navigation (shows → seasons → episodes)
3. **TMDB Wizard** - Multi-step metadata selection (text, poster, hero, summary)
4. **Wizard Summary** - Review and edit selections before creating
5. **Change Artwork** - Modify poster or hero from summary step

        `,
      },
    },
  },
  argTypes: {
    parentName: {
      control: "text",
      description: "Parent item name for context (optional)",
    },
    hasDriveConnection: {
      control: "boolean",
      description: "Whether user has Google Drive connected (enables uploads)",
    },
    buttonLabel: {
      control: "text",
      description: "Label for the trigger button",
    },
  },
} satisfies Meta<typeof DialogWithTrigger>;

export default meta;
type Story = StoryObj<typeof meta>;

// Mock handlers
const mockOnAdd = fn(async () => ({ itemId: "new-item-123" }));
const mockOnComplete = fn(async () => {});

// === STANDARD VARIANTS ===

export const Default: Story = {
  args: {
    onAdd: mockOnAdd,
    onComplete: mockOnComplete,
    hasDriveConnection: false,
    buttonLabel: "Add Item",
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const trigger = canvas.getByTestId("dialog-trigger");
    await userEvent.click(trigger);
    // Dialog renders in portal, search in document.body
    const body = within(document.body);
    await body.findByLabelText(/name/i);
  },
  parameters: {
    docs: {
      description: {
        story:
          "Default state without Google Drive connection. Click the button to open the dialog.",
      },
    },
  },
};

export const WithParent: Story = {
  args: {
    onAdd: mockOnAdd,
    onComplete: mockOnComplete,
    parentName: "Movies Collection",
    hasDriveConnection: false,
    buttonLabel: "Add Child Item",
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const trigger = canvas.getByTestId("dialog-trigger");
    await userEvent.click(trigger);
    const body = within(document.body);
    await body.findByLabelText(/name/i);
  },
  parameters: {
    docs: {
      description: {
        story:
          'Creating a child item. Shows parent context: "inside Movies Collection".',
      },
    },
  },
};

export const WithDriveConnection: Story = {
  args: {
    onAdd: mockOnAdd,
    onComplete: mockOnComplete,
    hasDriveConnection: true,
    buttonLabel: "Add Item (with Drive)",
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const trigger = canvas.getByTestId("dialog-trigger");
    await userEvent.click(trigger);
    const body = within(document.body);
    await body.findByLabelText(/name/i);
  },
  parameters: {
    docs: {
      description: {
        story:
          "With Google Drive connected. Shows both Details and Files tabs for uploading media.",
      },
    },
  },
};

// === INTERACTION TESTS ===

/**
 * Form input interaction.
 * Tests typing in name and description fields.
 */
export const FormInteraction: Story = {
  args: {
    onAdd: mockOnAdd,
    onComplete: mockOnComplete,
    hasDriveConnection: false,
    buttonLabel: "Test Form Input",
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    // Open dialog
    const trigger = canvas.getByTestId("dialog-trigger");
    await userEvent.click(trigger);

    // Dialog renders in portal, search in document.body
    const body = within(document.body);

    // Wait for dialog to appear
    const nameInput = await body.findByLabelText(/name/i);
    await expect(nameInput).toBeInTheDocument();

    // Type a name
    await userEvent.type(nameInput, "My New Movie");
    await expect(nameInput).toHaveValue("My New Movie");

    // Find and type in description
    const descriptionInput = body.getByLabelText(/description/i);
    await userEvent.type(descriptionInput, "A great film about adventure");
    await expect(descriptionInput).toHaveValue("A great film about adventure");
  },
  parameters: {
    docs: {
      description: {
        story:
          "Demonstrates form input interaction. Name and description can be entered manually.",
      },
    },
  },
};

/**
 * TMDB search trigger.
 * Tests opening the TMDB search combobox.
 */
export const TMDBSearchInteraction: Story = {
  args: {
    onAdd: mockOnAdd,
    onComplete: mockOnComplete,
    hasDriveConnection: false,
    buttonLabel: "Test TMDB Search",
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    // Open dialog
    const trigger = canvas.getByTestId("dialog-trigger");
    await userEvent.click(trigger);

    // Dialog renders in portal, search in document.body
    const body = within(document.body);

    // Wait for dialog to appear
    await body.findByLabelText(/name/i);

    // Wait for TMDB search combobox (may take time to check TMDB availability)
    const searchTrigger = await body.findByRole("combobox", {}, { timeout: 5000 });
    await userEvent.click(searchTrigger);
  },
  parameters: {
    docs: {
      description: {
        story:
          "Clicking the search combobox opens TMDB search. Requires API mocking for full functionality.",
      },
    },
  },
};

/**
 * Tab switching with Drive connection.
 * Tests navigating between Details and Files tabs.
 */
export const TabSwitching: Story = {
  args: {
    onAdd: mockOnAdd,
    onComplete: mockOnComplete,
    hasDriveConnection: true,
    buttonLabel: "Test Tab Switching",
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    // Open dialog
    const trigger = canvas.getByTestId("dialog-trigger");
    await userEvent.click(trigger);

    // Dialog renders in portal, search in document.body
    const body = within(document.body);

    // Wait for dialog to appear
    await body.findByLabelText(/name/i);

    // Find and click Files tab
    const filesTab = body.getByRole("tab", { name: /files/i });
    await expect(filesTab).toBeInTheDocument();
    await userEvent.click(filesTab);

    // Verify Files tab content is shown (look for Primary Media label)
    await waitFor(
      async () => {
        const mediaLabel = body.queryByText(/primary media/i);
        await expect(mediaLabel).toBeInTheDocument();
      },
      { timeout: 3000 }
    );

    // Switch back to Details tab
    const detailsTab = body.getByRole("tab", { name: /details/i });
    await userEvent.click(detailsTab);

    // Verify Details tab content is shown
    await waitFor(
      async () => {
        const nameInput = body.queryByLabelText(/name/i);
        await expect(nameInput).toBeInTheDocument();
      },
      { timeout: 3000 }
    );
  },
  parameters: {
    docs: {
      description: {
        story:
          "With Drive connected, users can switch between Details and Files tabs.",
      },
    },
  },
};
