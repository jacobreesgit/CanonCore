/**
 * Storybook stories for the ItemSettingsDialog component.
 * Demonstrates the settings dialog with tabbed interface and TMDB integration.
 */

import { useState } from "react";
import type { Meta, StoryObj } from "@storybook/nextjs";
import { fn, userEvent, within } from "storybook/test";

import { Button } from "@/components/ui/button";
import { ItemSettingsDialog } from "./item-settings-dialog";
import type { SerializedItemFile } from "@/lib/types";

/**
 * Wrapper component that provides a trigger button for the dialog.
 */
function DialogWithTrigger(
  props: Omit<
    React.ComponentProps<typeof ItemSettingsDialog>,
    "open" | "onOpenChange"
  > & {
    buttonLabel?: string;
  }
) {
  const [open, setOpen] = useState(false);
  const { buttonLabel = "Open Settings", ...dialogProps } = props;

  return (
    <>
      <Button onClick={() => setOpen(true)} data-testid="dialog-trigger">
        {buttonLabel}
      </Button>
      <ItemSettingsDialog {...dialogProps} open={open} onOpenChange={setOpen} />
    </>
  );
}

const meta = {
  title: "Items/Dialogs/ItemSettingsDialog",
  component: DialogWithTrigger,
  tags: ["autodocs"],
  parameters: {
    layout: "centered",
    docs: {
      description: {
        component: `
Unified settings dialog for editing item metadata and managing files.

## Features

- **Details Tab** - Edit name, description, and visibility settings
- **Files Tab** - Manage media, artwork, and subtitle files (requires Drive connection)
- **TMDB Integration** - Search and apply metadata from TMDB
- **Visibility Controls** - Set public/private and inherit visibility
- **Dirty State Tracking** - Only enables Save when changes are made

## Step Flow

1. **Main** - Details tab and Files tab (if Drive connected)
2. **Episode Picker** - TV show navigation when selecting TV metadata
3. **TMDB Wizard** - Multi-step metadata application wizard

        `,
      },
    },
  },
  argTypes: {
    hasDriveConnection: {
      control: "boolean",
      description: "Whether user has Google Drive connected",
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
const mockOnSettingsChange = fn(async () => {});

// Mock file data
const createMockFile = (
  overrides: Partial<SerializedItemFile> = {}
): SerializedItemFile => ({
  id: `file-${Math.random().toString(36).slice(2)}`,
  filename: "untitled.mp4",
  mimeType: "video/mp4",
  fileType: "MEDIA",
  isPrimary: false,
  isHero: false,
  playbackPosition: 0,
  playbackDuration: null,
  createdAt: new Date(),
  updatedAt: new Date(),
  driveFileId: null,
  itemId: "item-123",
  size: null,
  syncStatus: "SYNCED",
  syncError: null,
  ...overrides,
});

// Default item
const defaultItem = {
  id: "item-123",
  name: "Inception",
  description:
    "A thief who steals corporate secrets through dream-sharing technology is given the task of planting an idea into the mind of a C.E.O.",
  isPublic: false,
  inheritVisibility: false,
  hasParent: true,
  hasChildren: false,
  tmdbId: null as number | null,
  tmdbShowTagline: true,
  tmdbShowMetadata: true,
  tmdbShowGenres: true,
  tmdbShowCast: true,
  tmdbShowProviders: true,
  tmdbShowVideos: true,
  tmdbShowRecommendations: true,
};

// Default files
const defaultFiles = {
  media: [
    createMockFile({
      id: "media-1",
      filename: "inception.mkv",
      mimeType: "video/x-matroska",
      fileType: "MEDIA",
      isPrimary: true,
    }),
  ],
  artwork: [
    createMockFile({
      id: "artwork-1",
      filename: "poster.jpg",
      mimeType: "image/jpeg",
      fileType: "ARTWORK",
      isPrimary: true,
      isHero: false,
    }),
    createMockFile({
      id: "artwork-2",
      filename: "backdrop.jpg",
      mimeType: "image/jpeg",
      fileType: "ARTWORK",
      isPrimary: false,
      isHero: true,
    }),
  ],
  subtitles: [
    createMockFile({
      id: "subtitle-1",
      filename: "inception.en.srt",
      mimeType: "application/x-subrip",
      fileType: "SUBTITLE",
      isPrimary: true,
    }),
  ],
};

// Empty files
const emptyFiles = {
  media: [],
  artwork: [],
  subtitles: [],
};

// === STANDARD VARIANTS ===

export const Default: Story = {
  args: {
    item: defaultItem,
    files: emptyFiles,
    hasDriveConnection: false,
    onSettingsChange: mockOnSettingsChange,
    buttonLabel: "Edit Item",
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
          "Default state without Google Drive connection. Click the button to open.",
      },
    },
  },
};

export const WithDriveConnection: Story = {
  args: {
    item: defaultItem,
    files: defaultFiles,
    hasDriveConnection: true,
    onSettingsChange: mockOnSettingsChange,
    buttonLabel: "Edit Item (with Drive)",
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
          "With Google Drive connected. Shows both Details and Files tabs with existing files.",
      },
    },
  },
};

export const PublicItem: Story = {
  args: {
    item: {
      ...defaultItem,
      isPublic: true,
      inheritVisibility: false,
    },
    files: defaultFiles,
    hasDriveConnection: true,
    onSettingsChange: mockOnSettingsChange,
    buttonLabel: "Edit Public Item",
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
        story: "Public item. Visibility toggle shows public state.",
      },
    },
  },
};

export const WithTmdbTab: Story = {
  args: {
    item: {
      ...defaultItem,
      tmdbId: 27205,
      tmdbShowTagline: true,
      tmdbShowMetadata: true,
      tmdbShowGenres: true,
      tmdbShowCast: false,
      tmdbShowProviders: true,
      tmdbShowVideos: false,
      tmdbShowRecommendations: true,
    },
    files: defaultFiles,
    hasDriveConnection: true,
    onSettingsChange: mockOnSettingsChange,
    buttonLabel: "Edit Item (TMDB)",
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const trigger = canvas.getByTestId("dialog-trigger");
    await userEvent.click(trigger);
    const body = within(document.body);
    const tmdbTab = await body.findByRole("tab", { name: /tmdb/i });
    await userEvent.click(tmdbTab);
  },
  parameters: {
    docs: {
      description: {
        story:
          "Item with TMDB metadata linked. Shows the TMDB tab with display option toggles for controlling which sections appear on the detail page.",
      },
    },
  },
};

export const LongDescription: Story = {
  args: {
    item: {
      ...defaultItem,
      description:
        "A thief who steals corporate secrets through the use of dream-sharing technology is given the inverse task of planting an idea into the mind of a C.E.O., but his tragic past may doom the project and his team to disaster. Dom Cobb is a skilled thief, the absolute best in the dangerous art of extraction, stealing valuable secrets from deep within the subconscious during the dream state, when the mind is at its most vulnerable. Cobb's rare ability has made him a coveted player in this treacherous new world of corporate espionage, but it has also made him an international fugitive and cost him everything he has ever loved. Now Cobb is being offered a chance at redemption.",
    },
    files: defaultFiles,
    hasDriveConnection: true,
    onSettingsChange: mockOnSettingsChange,
    buttonLabel: "Edit (Long Description)",
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
          "Item with a long description approaching the 1000 character limit.",
      },
    },
  },
};
