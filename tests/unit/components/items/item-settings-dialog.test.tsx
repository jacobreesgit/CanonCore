/**
 * Unit tests for ItemSettingsDialog component.
 * Tests Select-based file selection with single atomic save.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ItemSettingsDialog } from "@/components/items/item-settings-dialog";
import type { SerializedItemFile } from "@/lib/types";
import { updateItemSettings } from "@/lib/item-file-actions";
import { toast } from "sonner";

// Mock server actions
vi.mock("@/lib/item-file-actions", () => ({
  updateItemSettings: vi.fn().mockResolvedValue({ success: true }),
}));

vi.mock("sonner", () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}));

describe("ItemSettingsDialog", () => {
  const defaultProps = {
    open: true,
    onOpenChange: vi.fn(),
    item: { id: "item-1", name: "Test Item", description: null },
    files: { media: [], artwork: [], subtitles: [] },
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  // Helper to create complete mock file objects
  const createMockFile = (
    overrides: Partial<SerializedItemFile> & { id: string; filename: string }
  ): SerializedItemFile => ({
    itemId: "item-1",
    sftpPath: `/${overrides.filename}`,
    fileType: "MEDIA" as const,
    mimeType: "video/mp4",
    size: null,
    sftpModifiedAt: null,
    isPrimary: false,
    isHero: false,
    playbackPosition: null,
    playbackDuration: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  });

  describe("Primary Media Select", () => {
    it("should hide media section when no media files", () => {
      render(<ItemSettingsDialog {...defaultProps} />);
      expect(screen.queryByLabelText(/primary media/i)).not.toBeInTheDocument();
    });

    it("should show disabled select when 1 media file", () => {
      const files = {
        media: [
          createMockFile({
            id: "m1",
            filename: "movie.mp4",
            isPrimary: true,
            size: 1024,
            playbackDuration: 7200,
          }),
        ],
        artwork: [],
        subtitles: [],
      };
      render(<ItemSettingsDialog {...defaultProps} files={files} />);

      const select = screen.getByRole("combobox", { name: /primary media/i });
      expect(select).toBeDisabled();
    });

    it("should show interactive select when 2+ media files", () => {
      const files = {
        media: [
          createMockFile({
            id: "m1",
            filename: "movie.mp4",
            isPrimary: true,
            size: 1024,
            playbackDuration: 7200,
          }),
          createMockFile({
            id: "m2",
            filename: "movie-hd.mkv",
            isPrimary: false,
            size: 2048,
            playbackDuration: 7200,
          }),
        ],
        artwork: [],
        subtitles: [],
      };
      render(<ItemSettingsDialog {...defaultProps} files={files} />);

      const select = screen.getByRole("combobox", { name: /primary media/i });
      expect(select).not.toBeDisabled();
    });

    it("should enable Save button when selection changes", async () => {
      const user = userEvent.setup();
      const files = {
        media: [
          createMockFile({
            id: "m1",
            filename: "movie.mp4",
            isPrimary: true,
            size: 1024,
          }),
          createMockFile({
            id: "m2",
            filename: "movie-hd.mkv",
            isPrimary: false,
            size: 2048,
          }),
        ],
        artwork: [],
        subtitles: [],
      };
      render(<ItemSettingsDialog {...defaultProps} files={files} />);

      // Save button should be disabled initially (no changes)
      const saveButton = screen.getByRole("button", { name: /save changes/i });
      expect(saveButton).toBeDisabled();

      // Change selection
      const select = screen.getByRole("combobox", { name: /primary media/i });
      await user.click(select);
      await user.click(screen.getByRole("option", { name: /movie-hd\.mkv/i }));

      // Save button should now be enabled
      expect(saveButton).not.toBeDisabled();
    });

    it("should call updateItemSettings when Save is clicked", async () => {
      const user = userEvent.setup();
      const files = {
        media: [
          createMockFile({ id: "m1", filename: "movie.mp4", isPrimary: true }),
          createMockFile({
            id: "m2",
            filename: "movie-hd.mkv",
            isPrimary: false,
          }),
        ],
        artwork: [],
        subtitles: [],
      };
      render(<ItemSettingsDialog {...defaultProps} files={files} />);

      // Change selection
      const select = screen.getByRole("combobox", { name: /primary media/i });
      await user.click(select);
      await user.click(screen.getByRole("option", { name: /movie-hd\.mkv/i }));

      // Click Save
      await user.click(screen.getByRole("button", { name: /save changes/i }));

      expect(vi.mocked(updateItemSettings)).toHaveBeenCalledWith("item-1", {
        primaryMediaId: "m2",
      });
    });

    it("should show error toast when updateItemSettings fails", async () => {
      vi.mocked(updateItemSettings).mockResolvedValueOnce({
        success: false,
        error: "Failed to update",
      });
      const user = userEvent.setup();
      const files = {
        media: [
          createMockFile({ id: "m1", filename: "movie.mp4", isPrimary: true }),
          createMockFile({
            id: "m2",
            filename: "movie-hd.mkv",
            isPrimary: false,
          }),
        ],
        artwork: [],
        subtitles: [],
      };
      render(<ItemSettingsDialog {...defaultProps} files={files} />);

      const select = screen.getByRole("combobox", { name: /primary media/i });
      await user.click(select);
      await user.click(screen.getByRole("option", { name: /movie-hd\.mkv/i }));
      await user.click(screen.getByRole("button", { name: /save changes/i }));

      expect(vi.mocked(toast.error)).toHaveBeenCalledWith("Failed to update");
    });
  });

  describe("Primary Artwork Select", () => {
    it("should show artwork filenames in select options", async () => {
      const user = userEvent.setup();
      const files = {
        media: [],
        artwork: [
          createMockFile({
            id: "a1",
            filename: "poster.jpg",
            isPrimary: true,
            fileType: "ARTWORK",
            mimeType: "image/jpeg",
          }),
          createMockFile({
            id: "a2",
            filename: "fanart.jpg",
            isPrimary: false,
            fileType: "ARTWORK",
            mimeType: "image/jpeg",
          }),
        ],
        subtitles: [],
      };
      render(<ItemSettingsDialog {...defaultProps} files={files} />);

      const select = screen.getByRole("combobox", { name: /primary artwork/i });
      await user.click(select);

      // Options should show filenames
      const options = screen.getAllByRole("option");
      expect(options).toHaveLength(2);
      expect(options[0]).toHaveTextContent("poster.jpg");
      expect(options[1]).toHaveTextContent("fanart.jpg");
    });
  });

  describe("Default Subtitle Select", () => {
    it("should show subtitle filenames in select", () => {
      const files = {
        media: [],
        artwork: [],
        subtitles: [
          createMockFile({
            id: "s1",
            filename: "movie.en.srt",
            isPrimary: true,
            fileType: "SUBTITLE",
            mimeType: "text/srt",
          }),
          createMockFile({
            id: "s2",
            filename: "movie.es.srt",
            isPrimary: false,
            fileType: "SUBTITLE",
            mimeType: "text/srt",
          }),
        ],
      };
      render(<ItemSettingsDialog {...defaultProps} files={files} />);

      const select = screen.getByRole("combobox", {
        name: /default subtitle/i,
      });
      expect(select).toBeInTheDocument();
    });

    it("should show disabled select when 1 subtitle file", () => {
      const files = {
        media: [],
        artwork: [],
        subtitles: [
          createMockFile({
            id: "s1",
            filename: "movie.en.srt",
            isPrimary: true,
            fileType: "SUBTITLE",
            mimeType: "text/srt",
          }),
        ],
      };
      render(<ItemSettingsDialog {...defaultProps} files={files} />);

      const select = screen.getByRole("combobox", {
        name: /default subtitle/i,
      });
      expect(select).toBeDisabled();
    });

    it("should save subtitle selection via updateItemSettings", async () => {
      const user = userEvent.setup();
      const files = {
        media: [],
        artwork: [],
        subtitles: [
          createMockFile({
            id: "s1",
            filename: "movie.en.srt",
            isPrimary: true,
            fileType: "SUBTITLE",
            mimeType: "text/srt",
          }),
          createMockFile({
            id: "s2",
            filename: "movie.es.srt",
            isPrimary: false,
            fileType: "SUBTITLE",
            mimeType: "text/srt",
          }),
        ],
      };
      render(<ItemSettingsDialog {...defaultProps} files={files} />);

      const select = screen.getByRole("combobox", {
        name: /default subtitle/i,
      });
      await user.click(select);
      await user.click(screen.getByRole("option", { name: /movie\.es\.srt/i }));
      await user.click(screen.getByRole("button", { name: /save changes/i }));

      expect(vi.mocked(updateItemSettings)).toHaveBeenCalledWith("item-1", {
        primarySubtitleId: "s2",
      });
    });
  });
});
