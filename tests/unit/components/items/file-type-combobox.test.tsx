/**
 * Unit tests for FileTypeCombobox component.
 * Tests select mode (delete, drive links) and upload-only mode (queuing, removing).
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { FileTypeCombobox } from "@/components/items/file-type-combobox";
import { Film, ImageIcon, FileText } from "lucide-react";
import type { SerializedItemFile, QueuedFile } from "@/lib/types";
import { deleteItemFile } from "@/lib/item-file-actions";
import { toast } from "sonner";

// Mock @/lib/env
vi.mock("@/lib/env", () => ({
  env: {
    DATABASE_URL: "postgresql://test:test@localhost:5432/test",
    AUTH_SECRET: "test-auth-secret",
    RESEND_API_KEY: "re_test_key",
    EMAIL_FROM: "test@example.com",
    NEXT_PUBLIC_APP_URL: "http://localhost:3000",
    UPSTASH_REDIS_REST_URL: "https://test.upstash.io",
    UPSTASH_REDIS_REST_TOKEN: "test-token",
    BYPASS_RATE_LIMIT: "true",
  },
}));

vi.mock("@/lib/item-file-actions", () => ({
  deleteItemFile: vi.fn().mockResolvedValue({ success: true }),
}));

vi.mock("@/lib/google-drive-actions", () => ({
  createUploadSessions: vi.fn().mockResolvedValue({ success: false }),
  confirmUpload: vi.fn().mockResolvedValue({ success: false }),
}));

vi.mock("sonner", () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}));

/** Helper to create a mock SerializedItemFile */
const createMockFile = (
  overrides: Partial<SerializedItemFile> & { id: string; filename: string }
): SerializedItemFile => ({
  itemId: "item-1",
  driveFileId: `drive-${overrides.id}`,
  fileType: "MEDIA" as const,
  mimeType: "video/mp4",
  size: null,
  syncStatus: "SYNCED",
  syncError: null,
  isPrimary: false,
  isHero: false,
  playbackPosition: null,
  playbackDuration: null,
  createdAt: new Date(),
  updatedAt: new Date(),
  ...overrides,
});

describe("FileTypeCombobox Delete", () => {
  const defaultProps = {
    label: "Primary Media",
    description: "The file that plays",
    icon: Film,
    files: [
      createMockFile({ id: "m1", filename: "movie.mp4", isPrimary: true }),
      createMockFile({ id: "m2", filename: "movie-hd.mkv" }),
    ],
    selectedId: "m1",
    onSelect: vi.fn(),
    onUploadComplete: vi.fn(),
    onFileDeleted: vi.fn(),
    itemId: "item-1",
    fileType: "media" as const,
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should render without errors", () => {
    render(<FileTypeCombobox {...defaultProps} />);
    expect(screen.getByRole("combobox")).toBeInTheDocument();
    expect(screen.getByText("Primary Media")).toBeInTheDocument();
  });

  it("should accept onFileDeleted prop", () => {
    const onFileDeleted = vi.fn();
    expect(() =>
      render(
        <FileTypeCombobox {...defaultProps} onFileDeleted={onFileDeleted} />
      )
    ).not.toThrow();
  });

  it("should show delete button on non-selected files in dropdown", async () => {
    // pointerEventsCheck: 0 bypasses JSDOM limitation with portal z-index
    const user = userEvent.setup({ pointerEventsCheck: 0 });
    render(<FileTypeCombobox {...defaultProps} />);

    // Open dropdown
    await user.click(screen.getByRole("combobox"));

    // The non-selected file (m2) should have a delete button
    const deleteButton = screen.getByTestId("delete-file-m2");
    expect(deleteButton).toBeInTheDocument();
  });

  it("should not show delete button for currently selected file", async () => {
    const user = userEvent.setup({ pointerEventsCheck: 0 });
    render(<FileTypeCombobox {...defaultProps} />);

    // Open dropdown
    await user.click(screen.getByRole("combobox"));

    // The selected file (m1) should NOT have a delete button
    const deleteButton = screen.queryByTestId("delete-file-m1");
    expect(deleteButton).not.toBeInTheDocument();
  });

  it("should open confirmation dialog when delete button clicked", async () => {
    const user = userEvent.setup({ pointerEventsCheck: 0 });
    render(<FileTypeCombobox {...defaultProps} />);

    // Open dropdown
    await user.click(screen.getByRole("combobox"));

    // Click delete button for non-selected file
    const deleteButton = screen.getByTestId("delete-file-m2");
    await user.click(deleteButton);

    // Confirmation dialog should appear with Delete File title
    // Note: combobox popover uses data-slot="popover-content",
    // while Dialog uses data-slot="dialog-content"
    await waitFor(() => {
      const deleteDialog = document.querySelector(
        '[data-slot="dialog-content"]'
      );
      expect(deleteDialog).toBeInTheDocument();
      expect(screen.getByText("Delete File")).toBeInTheDocument();
      // Check the description mentions the filename (use queryAllByText to handle multiple matches)
      const descriptions = screen.getAllByText(/movie-hd\.mkv/);
      expect(descriptions.length).toBeGreaterThanOrEqual(1);
    });
  });

  it("should call deleteItemFile when confirmed", async () => {
    const user = userEvent.setup({ pointerEventsCheck: 0 });
    render(<FileTypeCombobox {...defaultProps} />);

    // Open dropdown
    await user.click(screen.getByRole("combobox"));

    // Click delete button to open dialog
    await user.click(screen.getByTestId("delete-file-m2"));

    // Click confirm button in dialog
    const confirmButton = await screen.findByRole("button", {
      name: /^delete$/i,
    });
    await user.click(confirmButton);

    expect(vi.mocked(deleteItemFile)).toHaveBeenCalledWith("m2");
  });

  it("should close dialog when cancelled", async () => {
    const user = userEvent.setup({ pointerEventsCheck: 0 });
    render(<FileTypeCombobox {...defaultProps} />);

    // Open dropdown
    await user.click(screen.getByRole("combobox"));

    // Click delete button to open dialog
    await user.click(screen.getByTestId("delete-file-m2"));

    // Wait for dialog
    await screen.findByRole("dialog");

    // Click cancel button
    const cancelButton = screen.getByRole("button", { name: /cancel/i });
    await user.click(cancelButton);

    // Dialog should close, deleteItemFile should NOT be called
    await waitFor(() => {
      expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    });
    expect(vi.mocked(deleteItemFile)).not.toHaveBeenCalled();
  });

  it("should show success toast and call onFileDeleted after deletion", async () => {
    vi.mocked(deleteItemFile).mockResolvedValueOnce({ success: true });
    const user = userEvent.setup({ pointerEventsCheck: 0 });
    render(<FileTypeCombobox {...defaultProps} />);

    // Open dropdown
    await user.click(screen.getByRole("combobox"));

    // Click delete button to open dialog
    await user.click(screen.getByTestId("delete-file-m2"));

    // Click confirm button
    const confirmButton = await screen.findByRole("button", {
      name: /^delete$/i,
    });
    await user.click(confirmButton);

    await waitFor(() => {
      expect(vi.mocked(toast.success)).toHaveBeenCalledWith("File deleted");
      expect(defaultProps.onFileDeleted).toHaveBeenCalled();
    });
  });

  it("should show error toast when deletion fails", async () => {
    vi.mocked(deleteItemFile).mockResolvedValueOnce({
      success: false,
      error: "Access denied",
    });
    const user = userEvent.setup({ pointerEventsCheck: 0 });
    render(<FileTypeCombobox {...defaultProps} />);

    // Open dropdown
    await user.click(screen.getByRole("combobox"));

    // Click delete button to open dialog
    await user.click(screen.getByTestId("delete-file-m2"));

    // Click confirm button
    const confirmButton = await screen.findByRole("button", {
      name: /^delete$/i,
    });
    await user.click(confirmButton);

    await waitFor(() => {
      expect(vi.mocked(toast.error)).toHaveBeenCalledWith("Access denied");
    });
    expect(defaultProps.onFileDeleted).not.toHaveBeenCalled();
  });

  it("should show loading state while deleting", async () => {
    // Create a promise that we control
    let resolveDelete: (value: { success: true }) => void;
    vi.mocked(deleteItemFile).mockImplementation(
      () =>
        new Promise((resolve) => {
          resolveDelete = resolve;
        })
    );

    const user = userEvent.setup({ pointerEventsCheck: 0 });
    render(<FileTypeCombobox {...defaultProps} />);

    // Open dropdown
    await user.click(screen.getByRole("combobox"));

    // Click delete button to open dialog
    await user.click(screen.getByTestId("delete-file-m2"));

    // Click confirm button
    const confirmButton = await screen.findByRole("button", {
      name: /^delete$/i,
    });
    await user.click(confirmButton);

    // While deleting, the confirm button should show "Deleting..." and be disabled
    await waitFor(() => {
      expect(screen.getByRole("button", { name: /deleting/i })).toBeDisabled();
    });

    // Resolve to clean up
    resolveDelete!({ success: true });

    await waitFor(() => {
      expect(vi.mocked(toast.success)).toHaveBeenCalled();
    });
  });

  it("should handle exception during deletion", async () => {
    vi.mocked(deleteItemFile).mockRejectedValueOnce(new Error("Network error"));
    const user = userEvent.setup({ pointerEventsCheck: 0 });
    render(<FileTypeCombobox {...defaultProps} />);

    // Open dropdown
    await user.click(screen.getByRole("combobox"));

    // Click delete button to open dialog
    await user.click(screen.getByTestId("delete-file-m2"));

    // Click confirm button
    const confirmButton = await screen.findByRole("button", {
      name: /^delete$/i,
    });
    await user.click(confirmButton);

    await waitFor(() => {
      expect(vi.mocked(toast.error)).toHaveBeenCalledWith(
        "Failed to delete file"
      );
    });
  });
});

describe("FileTypeCombobox Drive Link", () => {
  const defaultProps = {
    label: "Primary Media",
    description: "The file that plays",
    icon: Film,
    files: [
      createMockFile({ id: "m1", filename: "movie.mp4", isPrimary: true }),
    ],
    selectedId: "m1",
    onSelect: vi.fn(),
    onUploadComplete: vi.fn(),
    onFileDeleted: vi.fn(),
    itemId: "item-1",
    fileType: "media" as const,
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should show Drive link icon for synced files", async () => {
    const user = userEvent.setup({ pointerEventsCheck: 0 });
    const files = [
      createMockFile({
        id: "m1",
        filename: "movie.mp4",
        isPrimary: true,
        driveFileId: "drive-file-123",
      }),
    ];
    render(<FileTypeCombobox {...defaultProps} files={files} />);

    await user.click(screen.getByRole("combobox"));

    const driveLink = screen.getByTestId("drive-link-m1");
    expect(driveLink).toBeInTheDocument();
    expect(driveLink).toHaveAttribute(
      "href",
      "https://drive.google.com/file/d/drive-file-123/view"
    );
  });

  it("should not show Drive link for files without driveFileId", async () => {
    const user = userEvent.setup({ pointerEventsCheck: 0 });
    const filesWithoutDrive = [
      createMockFile({
        id: "m1",
        filename: "local.mp4",
        isPrimary: true,
        driveFileId: null,
      }),
    ];

    render(<FileTypeCombobox {...defaultProps} files={filesWithoutDrive} />);

    await user.click(screen.getByRole("combobox"));

    expect(screen.queryByTestId("drive-link-m1")).not.toBeInTheDocument();
  });

  it("should open Drive link in new tab with security attributes", async () => {
    const user = userEvent.setup({ pointerEventsCheck: 0 });
    const files = [
      createMockFile({
        id: "m1",
        filename: "movie.mp4",
        isPrimary: true,
        driveFileId: "drive-file-123",
      }),
    ];
    render(<FileTypeCombobox {...defaultProps} files={files} />);

    await user.click(screen.getByRole("combobox"));

    const driveLink = screen.getByTestId("drive-link-m1");
    expect(driveLink).toHaveAttribute("target", "_blank");
    expect(driveLink).toHaveAttribute("rel", "noopener noreferrer");
  });
});

/** Helper to create a mock QueuedFile */
const createMockQueuedFile = (
  overrides: Partial<QueuedFile> & { id: string; name: string }
): QueuedFile => {
  const { id, name, ...rest } = overrides;
  return {
    id,
    file: new File(["content"], name, { type: "video/mp4" }),
    fileType: "MEDIA" as const,
    size: 1024,
    status: "pending" as const,
    ...rest,
  };
};

describe("FileTypeCombobox Upload-Only Mode", () => {
  const defaultProps = {
    uploadOnly: true as const,
    label: "Primary Media",
    description: "The file that plays when clicking on this item.",
    icon: Film,
    fileType: "media" as const,
    queuedFiles: [] as QueuedFile[],
    onQueueFilesChange: vi.fn(),
    disabled: false,
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should render dropzone instead of combobox in uploadOnly mode", () => {
    render(<FileTypeCombobox {...defaultProps} />);

    // Should NOT have a combobox
    expect(screen.queryByRole("combobox")).not.toBeInTheDocument();

    // Should have the label and description
    expect(screen.getByText("Primary Media")).toBeInTheDocument();
    expect(
      screen.getByText("The file that plays when clicking on this item.")
    ).toBeInTheDocument();

    // Should have dropzone text
    expect(
      screen.getByText(/drop media files or click to browse/i)
    ).toBeInTheDocument();
  });

  it("should show disabled state with Drive connection message", () => {
    render(<FileTypeCombobox {...defaultProps} disabled={true} />);

    expect(
      screen.getByText(
        /connect google drive in settings to enable file uploads/i
      )
    ).toBeInTheDocument();

    // Should NOT have dropzone when disabled
    expect(
      screen.queryByText(/drop media files or click to browse/i)
    ).not.toBeInTheDocument();
  });

  it("should display queued files with size and remove button", () => {
    const queuedFiles = [
      createMockQueuedFile({ id: "f1", name: "movie.mp4" }),
      createMockQueuedFile({ id: "f2", name: "trailer.mp4" }),
    ];

    render(<FileTypeCombobox {...defaultProps} queuedFiles={queuedFiles} />);

    // Should show file names
    expect(screen.getByText("movie.mp4")).toBeInTheDocument();
    expect(screen.getByText("trailer.mp4")).toBeInTheDocument();

    // Should show queued count
    expect(screen.getByText(/2 files queued/i)).toBeInTheDocument();

    // Should have remove buttons for each file
    const removeButtons = screen.getAllByRole("button", {
      name: /remove/i,
    });
    expect(removeButtons).toHaveLength(2);
  });

  it("should call onQueueFilesChange with filtered array when removing file", async () => {
    const user = userEvent.setup();
    const queuedFiles = [
      createMockQueuedFile({ id: "f1", name: "movie.mp4" }),
      createMockQueuedFile({ id: "f2", name: "trailer.mp4" }),
    ];
    const onQueueFilesChange = vi.fn();

    render(
      <FileTypeCombobox
        {...defaultProps}
        queuedFiles={queuedFiles}
        onQueueFilesChange={onQueueFilesChange}
      />
    );

    // Click remove button for first file
    const removeButton = screen.getByRole("button", {
      name: /remove movie\.mp4/i,
    });
    await user.click(removeButton);

    // Should be called with array excluding the removed file
    expect(onQueueFilesChange).toHaveBeenCalledWith([queuedFiles[1]]);
  });

  it("should show singular 'file' when only one file queued", () => {
    const queuedFiles = [createMockQueuedFile({ id: "f1", name: "movie.mp4" })];

    render(<FileTypeCombobox {...defaultProps} queuedFiles={queuedFiles} />);

    expect(screen.getByText(/1 file queued/i)).toBeInTheDocument();
  });

  it("should use correct file type for different categories", () => {
    // Test artwork category
    render(
      <FileTypeCombobox
        {...defaultProps}
        label="Primary Artwork"
        description="The image used as the thumbnail."
        icon={ImageIcon}
        fileType="artwork"
      />
    );

    expect(screen.getByText("Primary Artwork")).toBeInTheDocument();
    expect(
      screen.getByText(/drop artwork files or click to browse/i)
    ).toBeInTheDocument();
  });

  it("should show total file size when files are queued", () => {
    const queuedFiles = [
      createMockQueuedFile({ id: "f1", name: "movie.mp4" }),
      {
        ...createMockQueuedFile({ id: "f2", name: "trailer.mp4" }),
        size: 2048,
      },
    ];

    render(<FileTypeCombobox {...defaultProps} queuedFiles={queuedFiles} />);

    // 1024 + 2048 = 3072 bytes = 3 KB (formatBytes only shows decimals for MB/GB)
    expect(screen.getByText("3 KB")).toBeInTheDocument();
  });
});

describe("FileTypeCombobox Upload-Only Mode - Subtitle Category", () => {
  const subtitleProps = {
    uploadOnly: true as const,
    label: "Default Subtitle",
    description: "The subtitle track that loads by default.",
    icon: FileText,
    fileType: "subtitle" as const,
    queuedFiles: [] as QueuedFile[],
    onQueueFilesChange: vi.fn(),
    disabled: false,
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should render subtitle dropzone with correct text", () => {
    render(<FileTypeCombobox {...subtitleProps} />);

    expect(screen.getByText("Default Subtitle")).toBeInTheDocument();
    expect(
      screen.getByText(/drop subtitle files or click to browse/i)
    ).toBeInTheDocument();
  });
});
