/**
 * Storybook stories for the FileTypeCombobox component.
 * Demonstrates file selection and upload modes.
 */

import type { Meta, StoryObj } from "@storybook/nextjs";
import { fn } from "storybook/test";
import {
  faFilm,
  faImage,
  faFileLines,
} from "@fortawesome/free-solid-svg-icons";

import { FileTypeCombobox } from "./file-type-combobox";
import type { SerializedItemFile, QueuedFile } from "@/lib/types";
import { SyncStatus } from "@prisma/client";

/**
 * Creates mock serialized item files for stories.
 */
const mockMediaFiles: SerializedItemFile[] = [
  {
    id: "file-1",
    itemId: "item-123",
    filename: "breaking_bad_s01e01.mkv",
    fileType: "MEDIA",
    mimeType: "video/x-matroska",
    size: 2400000000,
    driveFileId: "drive-abc123",
    syncStatus: SyncStatus.SYNCED,
    syncError: null,
    isPrimary: true,
    isHero: false,
    isLogo: false,
    playbackPosition: 1200,
    playbackDuration: 3600,
    createdAt: new Date("2024-01-15T10:30:00Z"),
    updatedAt: new Date("2024-01-15T10:30:00Z"),
  },
  {
    id: "file-2",
    itemId: "item-123",
    filename: "breaking_bad_s01e02.mkv",
    fileType: "MEDIA",
    mimeType: "video/x-matroska",
    size: 2350000000,
    driveFileId: "drive-def456",
    syncStatus: SyncStatus.SYNCED,
    syncError: null,
    isPrimary: false,
    isHero: false,
    isLogo: false,
    playbackPosition: 0,
    playbackDuration: 3500,
    createdAt: new Date("2024-01-16T14:00:00Z"),
    updatedAt: new Date("2024-01-16T14:00:00Z"),
  },
];

const mockArtworkFiles: SerializedItemFile[] = [
  {
    id: "art-1",
    itemId: "item-123",
    filename: "poster.jpg",
    fileType: "ARTWORK",
    mimeType: "image/jpeg",
    size: 245000,
    driveFileId: "drive-poster1",
    syncStatus: SyncStatus.SYNCED,
    syncError: null,
    isPrimary: true,
    isHero: false,
    isLogo: false,
    playbackPosition: null,
    playbackDuration: null,
    createdAt: new Date("2024-01-15T10:00:00Z"),
    updatedAt: new Date("2024-01-15T10:00:00Z"),
  },
  {
    id: "art-2",
    itemId: "item-123",
    filename: "backdrop.jpg",
    fileType: "ARTWORK",
    mimeType: "image/jpeg",
    size: 512000,
    driveFileId: "drive-backdrop1",
    syncStatus: SyncStatus.SYNCED,
    syncError: null,
    isPrimary: false,
    isHero: true,
    isLogo: false,
    playbackPosition: null,
    playbackDuration: null,
    createdAt: new Date("2024-01-15T10:00:00Z"),
    updatedAt: new Date("2024-01-15T10:00:00Z"),
  },
];

/**
 * Creates a mock queued file.
 */
function createMockQueuedFile(name: string, size: number): QueuedFile {
  const mockBlob = new Blob(["mock data"], { type: "image/jpeg" });
  const mockFile = new File([mockBlob], name, { type: "image/jpeg" });

  return {
    id: `queued-${name.replace(/[^a-z0-9]/gi, "-")}`,
    file: mockFile,
    fileType: "ARTWORK",
    size,
    status: "pending",
    isPrimary: false,
    isHero: false,
  };
}

/**
 * FileTypeCombobox uses discriminated union props, so we use render functions
 * for all stories instead of args to handle the mutually exclusive prop sets.
 */
const meta: Meta<typeof FileTypeCombobox> = {
  title: "Items/Search/FileTypeCombobox",
  component: FileTypeCombobox,
  tags: ["autodocs"],
  parameters: {
    layout: "centered",
    docs: {
      description: {
        component:
          "Combines file selection with inline upload capability. Supports select mode (dropdown) and upload-only mode (dropzone).",
      },
    },
    // Disable nested-interactive check - the Dropzone component uses a Button
    // wrapper with a hidden file input, which is a common react-dropzone pattern
    a11y: {
      config: {
        rules: [{ id: "nested-interactive", enabled: false }],
      },
    },
  },
  decorators: [
    (Story) => (
      <div className="w-[400px] p-4">
        <Story />
      </div>
    ),
  ],
};

export default meta;

// Use a looser type since discriminated unions make args inference `never`
type Story = StoryObj<typeof FileTypeCombobox>;

// === SELECT MODE VARIANTS ===

export const MediaSelectMode: Story = {
  render: () => (
    <FileTypeCombobox
      label="Primary Media"
      description="Select the main video or audio file for this item"
      icon={faFilm}
      fileType="media"
      uploadOnly={false}
      files={mockMediaFiles}
      selectedId={undefined}
      itemId="item-123"
      onSelect={fn()}
      onUploadComplete={fn()}
      onFileDeleted={fn()}
    />
  ),
};

export const MediaWithSelection: Story = {
  render: () => (
    <FileTypeCombobox
      label="Primary Media"
      description="Select the main video or audio file for this item"
      icon={faFilm}
      fileType="media"
      uploadOnly={false}
      files={mockMediaFiles}
      selectedId="file-1"
      itemId="item-123"
      onSelect={fn()}
      onUploadComplete={fn()}
      onFileDeleted={fn()}
    />
  ),
  parameters: {
    docs: {
      description: {
        story: "Combobox with a file already selected.",
      },
    },
  },
};

export const ArtworkSelectMode: Story = {
  render: () => (
    <FileTypeCombobox
      label="Poster"
      description="Select poster artwork for this item"
      icon={faImage}
      fileType="artwork"
      uploadOnly={false}
      files={mockArtworkFiles}
      selectedId="art-1"
      itemId="item-123"
      onSelect={fn()}
      onUploadComplete={fn()}
      onFileDeleted={fn()}
    />
  ),
  parameters: {
    docs: {
      description: {
        story: "Artwork combobox shows thumbnail previews in the dropdown.",
      },
    },
  },
};

export const SubtitleSelectMode: Story = {
  render: () => (
    <FileTypeCombobox
      label="Subtitles"
      description="Select subtitle file for this media"
      icon={faFileLines}
      fileType="subtitle"
      uploadOnly={false}
      files={[]}
      selectedId={undefined}
      itemId="item-123"
      onSelect={fn()}
      onUploadComplete={fn()}
      onFileDeleted={fn()}
    />
  ),
  parameters: {
    docs: {
      description: {
        story: "Subtitle combobox with no files yet.",
      },
    },
  },
};

export const EmptyFileList: Story = {
  render: () => (
    <FileTypeCombobox
      label="Primary Media"
      description="No media files uploaded yet"
      icon={faFilm}
      fileType="media"
      uploadOnly={false}
      files={[]}
      selectedId={undefined}
      itemId="item-123"
      onSelect={fn()}
      onUploadComplete={fn()}
      onFileDeleted={fn()}
    />
  ),
  parameters: {
    docs: {
      description: {
        story: "Combobox shows empty state when no files available.",
      },
    },
  },
};

export const DisabledNoDrive: Story = {
  render: () => (
    <FileTypeCombobox
      label="Primary Media"
      description="Connect Google Drive to upload files"
      icon={faFilm}
      fileType="media"
      uploadOnly={false}
      files={[]}
      selectedId={undefined}
      itemId="item-123"
      disabled={true}
      onSelect={fn()}
      onUploadComplete={fn()}
      onFileDeleted={fn()}
    />
  ),
  parameters: {
    docs: {
      description: {
        story: "Combobox disabled when Google Drive is not connected.",
      },
    },
  },
};

// === UPLOAD-ONLY MODE VARIANTS ===

export const UploadOnlyMode: Story = {
  render: () => (
    <FileTypeCombobox
      label="Poster"
      description="Drop poster images here or click to browse"
      icon={faImage}
      fileType="artwork"
      uploadOnly={true}
      queuedFiles={[]}
      onQueueFilesChange={fn()}
    />
  ),
  parameters: {
    docs: {
      description: {
        story:
          "Upload-only mode shows dropzone for queueing files before item creation.",
      },
    },
  },
};

export const UploadOnlyWithFiles: Story = {
  render: () => (
    <FileTypeCombobox
      label="Poster"
      description="Poster images queued for upload"
      icon={faImage}
      fileType="artwork"
      uploadOnly={true}
      queuedFiles={[
        createMockQueuedFile("poster_v1.jpg", 245000),
        createMockQueuedFile("poster_v2.jpg", 312000),
      ]}
      onQueueFilesChange={fn()}
    />
  ),
  parameters: {
    docs: {
      description: {
        story: "Upload-only mode with files queued.",
      },
    },
  },
};

export const UploadOnlyDisabled: Story = {
  render: () => (
    <FileTypeCombobox
      label="Poster"
      description="Connect Google Drive to upload files"
      icon={faImage}
      fileType="artwork"
      uploadOnly={true}
      queuedFiles={[]}
      disabled={true}
      onQueueFilesChange={fn()}
    />
  ),
  parameters: {
    docs: {
      description: {
        story: "Upload-only mode disabled without Drive connection.",
      },
    },
  },
};
