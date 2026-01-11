/**
 * Unit tests for FileTypeCombobox delete functionality.
 * Tests rendering, delete button visibility, confirmation dialog, and deletion flow.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { FileTypeCombobox } from "@/components/items/file-type-combobox";
import { Film } from "lucide-react";
import type { SerializedItemFile } from "@/lib/types";
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

    // Confirmation dialog should appear
    await waitFor(() => {
      expect(screen.getByRole("dialog")).toBeInTheDocument();
      expect(screen.getByText("Delete File")).toBeInTheDocument();
      expect(screen.getByText(/movie-hd\.mkv/)).toBeInTheDocument();
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
