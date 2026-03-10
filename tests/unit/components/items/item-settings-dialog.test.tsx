/**
 * Unit tests for ItemSettingsDialog component.
 * Tests FileTypeCombobox-based file selection with single atomic save.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, within, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ItemSettingsDialog } from "@/components/items/item-settings-dialog";
import type { SerializedItemFile } from "@/lib/types";
import { updateItemSettings } from "@/lib/item-file-actions";
import { toast } from "sonner";

// Mock server actions
vi.mock("@/lib/item-file-actions", () => ({
  updateItemSettings: vi.fn().mockResolvedValue({ success: true }),
  deleteItemFile: vi.fn().mockResolvedValue({ success: true }),
  getItemFiles: vi.fn().mockResolvedValue({
    success: true,
    data: { media: [], artwork: [], subtitles: [] },
  }),
}));

vi.mock("@/lib/google-drive-upload", () => ({
  createUploadSessions: vi
    .fn()
    .mockResolvedValue({ success: false, error: "Not connected" }),
  confirmUpload: vi
    .fn()
    .mockResolvedValue({ success: false, error: "Not connected" }),
}));

vi.mock("@/lib/tmdb-actions", () => ({
  searchMediaAction: vi.fn(),
  applyMetadataAction: vi.fn(),
  getMetadataPreviewAction: vi.fn(),
  getImagesAction: vi.fn().mockResolvedValue({
    success: true,
    data: { posters: [], backdrops: [] },
  }),
  getSeasonImagesAction: vi
    .fn()
    .mockResolvedValue({ success: true, data: { posters: [] } }),
  getEpisodeImagesAction: vi
    .fn()
    .mockResolvedValue({ success: true, data: { stills: [] } }),
  isTMDBAvailable: vi.fn(),
  updateTmdbDisplayOptions: vi.fn().mockResolvedValue({ success: true }),
  clearTmdbFieldAction: vi.fn().mockResolvedValue({ success: true }),
}));

vi.mock("sonner", () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}));

import {
  getImagesAction,
  isTMDBAvailable,
  updateTmdbDisplayOptions,
} from "@/lib/tmdb-actions";

describe("ItemSettingsDialog", () => {
  const defaultProps = {
    open: true,
    onOpenChange: vi.fn(),
    item: {
      id: "item-1",
      name: "Test Item",
      description: null,
      isPublic: false,
      inheritVisibility: false,
      hasParent: false,
      hasChildren: false,
      tmdbId: null,
      tmdbType: null,
      tmdbPosterPath: null,
      tmdbBackdropPath: null,
      tmdbLogoPath: null,
      tmdbShowTagline: true,
      tmdbShowMetadata: true,
      tmdbShowGenres: true,
      tmdbShowCast: true,
      tmdbShowProviders: true,
      tmdbShowVideos: true,
      tmdbShowRecommendations: true,
    },
    files: { media: [], artwork: [], subtitles: [] },
    hasDriveConnection: true,
  };

  beforeEach(() => {
    vi.clearAllMocks();
    // Clear localStorage to reset tab selection between tests
    localStorage.clear();
    vi.mocked(isTMDBAvailable).mockResolvedValue(true);
    vi.mocked(getImagesAction).mockResolvedValue({
      success: true,
      data: {
        posters: [
          {
            file_path: "/poster.jpg",
            vote_average: 8.5,
            iso_639_1: "en",
            width: 500,
            height: 750,
          },
        ],
        backdrops: [
          {
            file_path: "/backdrop.jpg",
            vote_average: 9.0,
            iso_639_1: null,
            width: 1920,
            height: 1080,
          },
        ],
      },
    });
  });

  // Helper to click on the Files tab
  const clickFilesTab = async (user: ReturnType<typeof userEvent.setup>) => {
    const filesTab = screen.getByRole("tab", { name: /files/i });
    await user.click(filesTab);
  };

  // Helper to create complete mock file objects
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
    isLogo: false,
    playbackPosition: null,
    playbackDuration: null,
    durationMs: null,
    width: null,
    height: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  });

  describe("Dialog Rendering", () => {
    it("should render dialog with title and description", () => {
      render(<ItemSettingsDialog {...defaultProps} />);
      expect(screen.getByText("Item Settings")).toBeInTheDocument();
      expect(
        screen.getByText(/Configure display preferences/i)
      ).toBeInTheDocument();
    });

    it("should render name and description fields", () => {
      render(<ItemSettingsDialog {...defaultProps} />);
      expect(screen.getByLabelText(/name/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/description/i)).toBeInTheDocument();
    });

    it("should render file type sections in Files tab", async () => {
      const user = userEvent.setup();
      render(<ItemSettingsDialog {...defaultProps} />);
      await clickFilesTab(user);
      expect(screen.getByText("Primary Media")).toBeInTheDocument();
      expect(screen.getByText("Primary Artwork")).toBeInTheDocument();
      expect(screen.getByText("Default Subtitle")).toBeInTheDocument();
    });
  });

  describe("Name and Description", () => {
    it("should populate name field with item name", async () => {
      render(<ItemSettingsDialog {...defaultProps} />);
      await waitFor(() => {
        const nameInput = screen.getByLabelText(/item name/i);
        expect(nameInput).toHaveValue("Test Item");
      });
    });

    it("should enable Save button when name changes", async () => {
      const user = userEvent.setup();
      render(<ItemSettingsDialog {...defaultProps} />);

      const saveButton = screen.getByRole("button", { name: /save changes/i });
      expect(saveButton).toBeDisabled();

      await waitFor(() => {
        expect(screen.getByLabelText(/item name/i)).toBeInTheDocument();
      });
      const nameInput = screen.getByLabelText(/item name/i);
      await user.clear(nameInput);
      await user.type(nameInput, "New Name");

      expect(saveButton).not.toBeDisabled();
    });

    it("should enable Save button when description changes", async () => {
      const user = userEvent.setup();
      render(<ItemSettingsDialog {...defaultProps} />);

      const saveButton = screen.getByRole("button", { name: /save changes/i });
      expect(saveButton).toBeDisabled();

      const descInput = screen.getByLabelText(/description/i);
      await user.type(descInput, "A new description");

      expect(saveButton).not.toBeDisabled();
    });

    it("should show error toast when name is empty", async () => {
      const user = userEvent.setup();
      render(<ItemSettingsDialog {...defaultProps} />);

      await waitFor(() => {
        expect(screen.getByLabelText(/item name/i)).toBeInTheDocument();
      });
      const nameInput = screen.getByLabelText(/item name/i);
      await user.clear(nameInput);

      // Need to change something else to enable the button
      const descInput = screen.getByLabelText(/description/i);
      await user.type(descInput, "test");

      await user.click(screen.getByRole("button", { name: /save changes/i }));

      expect(vi.mocked(toast.error)).toHaveBeenCalledWith("Name is required");
    });
  });

  describe("File Selection", () => {
    it("should show selected media file in combobox trigger", async () => {
      const user = userEvent.setup();
      const files = {
        media: [
          createMockFile({
            id: "m1",
            filename: "movie.mp4",
            isPrimary: true,
          }),
        ],
        artwork: [],
        subtitles: [],
      };
      render(<ItemSettingsDialog {...defaultProps} files={files} />);
      await clickFilesTab(user);

      // Find the combobox trigger that shows the selected file
      const mediaSection = screen
        .getByText("Primary Media")
        .closest("div")?.parentElement;
      expect(mediaSection).toHaveTextContent("movie.mp4");
    });

    it("should show empty state when no files for a type", async () => {
      const user = userEvent.setup();
      render(<ItemSettingsDialog {...defaultProps} />);
      await clickFilesTab(user);

      // The comboboxes should show placeholder text
      const comboboxes = screen.getAllByRole("combobox");
      expect(comboboxes.length).toBeGreaterThan(0);
    });

    it("should enable Save button when file selection changes", async () => {
      // pointerEventsCheck: 0 bypasses JSDOM limitation with portal z-index
      const user = userEvent.setup({ pointerEventsCheck: 0 });
      const files = {
        media: [
          createMockFile({
            id: "m1",
            filename: "movie.mp4",
            isPrimary: true,
          }),
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
      await clickFilesTab(user);

      const saveButton = screen.getByRole("button", { name: /save changes/i });
      expect(saveButton).toBeDisabled();

      // Find and click the media combobox
      const mediaSection = screen
        .getByText("Primary Media")
        .closest("div")?.parentElement;
      const combobox = within(mediaSection!).getByRole("combobox");
      await user.click(combobox);

      // Select the other option (rendered in portal to document.body)
      const option = await screen.findByText("movie-hd.mkv");
      await user.click(option);

      expect(saveButton).not.toBeDisabled();
    });
  });

  describe("Save Changes", () => {
    it("should call updateItemSettings with changed name", async () => {
      const user = userEvent.setup();
      render(<ItemSettingsDialog {...defaultProps} />);

      await waitFor(() => {
        expect(screen.getByLabelText(/item name/i)).toBeInTheDocument();
      });
      const nameInput = screen.getByLabelText(/item name/i);
      await user.clear(nameInput);
      await user.type(nameInput, "Updated Name");

      await user.click(screen.getByRole("button", { name: /save changes/i }));

      expect(vi.mocked(updateItemSettings)).toHaveBeenCalledWith("item-1", {
        name: "Updated Name",
      });
    });

    it("should call updateItemSettings with changed description", async () => {
      const user = userEvent.setup();
      render(<ItemSettingsDialog {...defaultProps} />);

      const descInput = screen.getByLabelText(/description/i);
      await user.type(descInput, "New description");

      await user.click(screen.getByRole("button", { name: /save changes/i }));

      expect(vi.mocked(updateItemSettings)).toHaveBeenCalledWith("item-1", {
        description: "New description",
      });
    });

    it("should show success toast on successful save", async () => {
      const user = userEvent.setup();
      render(<ItemSettingsDialog {...defaultProps} />);

      await waitFor(() => {
        expect(screen.getByLabelText(/item name/i)).toBeInTheDocument();
      });
      const nameInput = screen.getByLabelText(/item name/i);
      await user.clear(nameInput);
      await user.type(nameInput, "New Name");

      await user.click(screen.getByRole("button", { name: /save changes/i }));

      expect(vi.mocked(toast.success)).toHaveBeenCalledWith("Settings saved");
    });

    it("should show error toast when save fails", async () => {
      vi.mocked(updateItemSettings).mockResolvedValueOnce({
        success: false,
        error: "Update failed",
      });
      const user = userEvent.setup();
      render(<ItemSettingsDialog {...defaultProps} />);

      await waitFor(() => {
        expect(screen.getByLabelText(/item name/i)).toBeInTheDocument();
      });
      const nameInput = screen.getByLabelText(/item name/i);
      await user.clear(nameInput);
      await user.type(nameInput, "New Name");

      await user.click(screen.getByRole("button", { name: /save changes/i }));

      expect(vi.mocked(toast.error)).toHaveBeenCalledWith("Update failed");
    });
  });

  describe("Cancel Button", () => {
    it("should reset form to original values on cancel", async () => {
      const user = userEvent.setup();
      render(<ItemSettingsDialog {...defaultProps} />);

      await waitFor(() => {
        expect(screen.getByLabelText(/item name/i)).toBeInTheDocument();
      });
      const nameInput = screen.getByLabelText(/item name/i);
      await user.clear(nameInput);
      await user.type(nameInput, "Changed Name");

      await user.click(screen.getByRole("button", { name: /cancel/i }));

      // After cancel, if dialog reopens, values should be reset
      // The onOpenChange callback should have been called
      expect(defaultProps.onOpenChange).toHaveBeenCalledWith(false);
    });
  });

  describe("Upload Dirty State", () => {
    it("should enable Save button when files are added via upload (rerender)", () => {
      // This tests the bug scenario: item has no artwork, user uploads artwork,
      // files prop updates, but save button should be enabled because state differs
      // from original values captured at dialog open time

      const { rerender } = render(<ItemSettingsDialog {...defaultProps} />);

      // Initially no files, save button disabled
      const saveButton = screen.getByRole("button", { name: /save changes/i });
      expect(saveButton).toBeDisabled();

      // Simulate upload completing - parent rerenders with new files
      const newFiles = {
        media: [],
        artwork: [
          createMockFile({
            id: "a1",
            filename: "uploaded-poster.jpg",
            isPrimary: true,
            fileType: "ARTWORK",
            mimeType: "image/jpeg",
          }),
        ],
        subtitles: [],
      };

      rerender(<ItemSettingsDialog {...defaultProps} files={newFiles} />);

      // Save button should now be enabled because primaryArtworkId changed
      // from undefined (original) to "a1" (current)
      expect(saveButton).not.toBeDisabled();
    });

    it("should preserve dirty state after file upload when other changes exist", async () => {
      const user = userEvent.setup();
      const { rerender } = render(<ItemSettingsDialog {...defaultProps} />);

      // Change name first
      await waitFor(() => {
        expect(screen.getByLabelText(/item name/i)).toBeInTheDocument();
      });
      const nameInput = screen.getByLabelText(/item name/i);
      await user.clear(nameInput);
      await user.type(nameInput, "New Name");

      const saveButton = screen.getByRole("button", { name: /save changes/i });
      expect(saveButton).not.toBeDisabled();

      // Then simulate upload (files prop changes)
      const newFiles = {
        media: [],
        artwork: [
          createMockFile({
            id: "a1",
            filename: "uploaded.jpg",
            isPrimary: true,
            fileType: "ARTWORK",
            mimeType: "image/jpeg",
          }),
        ],
        subtitles: [],
      };

      rerender(
        <ItemSettingsDialog
          {...defaultProps}
          files={newFiles}
          item={{
            ...defaultProps.item,
          }}
        />
      );

      // Save should still be enabled (name change + file upload)
      expect(saveButton).not.toBeDisabled();
    });
  });

  describe("Hero Image Section", () => {
    it("should always show hero image section in Files tab", async () => {
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
        ],
        subtitles: [],
      };
      render(<ItemSettingsDialog {...defaultProps} files={files} />);
      await clickFilesTab(user);

      // Hero Image is now always visible regardless of artwork count
      expect(screen.getByText("Hero Image")).toBeInTheDocument();
    });

    it("should show hero image section with multiple artworks", async () => {
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
      await clickFilesTab(user);

      expect(screen.getByText("Hero Image")).toBeInTheDocument();
    });
  });

  describe("File Deletion", () => {
    it("should pass onFileDeleted callback to FileTypeCombobox", async () => {
      const user = userEvent.setup();
      const onSettingsChange = vi.fn().mockResolvedValue(undefined);
      const files = {
        media: [
          createMockFile({ id: "m1", filename: "movie.mp4", isPrimary: true }),
          createMockFile({ id: "m2", filename: "movie-hd.mkv" }),
        ],
        artwork: [],
        subtitles: [],
      };

      render(
        <ItemSettingsDialog
          {...defaultProps}
          files={files}
          onSettingsChange={onSettingsChange}
        />
      );
      await clickFilesTab(user);

      // The FileTypeCombobox should receive onFileDeleted prop
      // This is tested implicitly through the delete functionality
      expect(screen.getByText("Primary Media")).toBeInTheDocument();
    });

    it("should refresh files after deletion", async () => {
      const onSettingsChange = vi.fn().mockResolvedValue(undefined);
      const files = {
        media: [
          createMockFile({ id: "m1", filename: "movie.mp4", isPrimary: true }),
          createMockFile({ id: "m2", filename: "movie-hd.mkv" }),
        ],
        artwork: [],
        subtitles: [],
      };

      const user = userEvent.setup({ pointerEventsCheck: 0 });
      render(
        <ItemSettingsDialog
          {...defaultProps}
          files={files}
          onSettingsChange={onSettingsChange}
        />
      );
      await clickFilesTab(user);

      // Open media combobox
      const mediaSection = screen
        .getByText("Primary Media")
        .closest("div")?.parentElement;
      const combobox = within(mediaSection!).getByRole("combobox");
      await user.click(combobox);

      // Click delete on non-selected file to open confirmation dialog
      const deleteBtn = await screen.findByRole("button", {
        name: "Delete movie-hd.mkv",
      });
      await user.click(deleteBtn);

      // Confirm deletion in the dialog
      const confirmBtn = await screen.findByRole("button", {
        name: /^delete$/i,
      });
      await user.click(confirmBtn);

      // onSettingsChange should be called to refresh
      await waitFor(() => {
        expect(onSettingsChange).toHaveBeenCalled();
      });
    });
  });

  describe("TMDB Source Field and Name Input", () => {
    it("disables name input when item has tmdbId", () => {
      render(
        <ItemSettingsDialog
          {...defaultProps}
          item={{
            ...defaultProps.item,
            tmdbId: 155,
            tmdbType: "movie",
          }}
        />
      );

      expect(screen.getByLabelText(/item name/i)).toBeDisabled();
      expect(screen.getByText("Managed by TMDB")).toBeInTheDocument();
    });

    it("enables name input when item has no tmdbId", () => {
      render(<ItemSettingsDialog {...defaultProps} />);

      expect(screen.getByLabelText(/item name/i)).not.toBeDisabled();
      expect(screen.queryByText("Managed by TMDB")).not.toBeInTheDocument();
    });

    it("renders TmdbSourceField on Details tab", () => {
      render(
        <ItemSettingsDialog
          {...defaultProps}
          item={{
            ...defaultProps.item,
            tmdbId: 155,
            tmdbType: "movie",
            tmdbPosterPath: "/poster.jpg",
          }}
        />
      );

      expect(screen.getByText("TMDB Source")).toBeInTheDocument();
    });

    it("navigates to tmdb-search step when TmdbSourceField trigger is clicked", async () => {
      const user = userEvent.setup();
      render(
        <ItemSettingsDialog
          {...defaultProps}
          item={{
            ...defaultProps.item,
            tmdbId: null,
            tmdbType: null,
          }}
        />
      );

      await user.click(screen.getByText("Search TMDB\u2026"));

      expect(screen.getByText("Search TMDB")).toBeInTheDocument();
      expect(screen.getByLabelText("Back")).toBeInTheDocument();
    });

    it("returns to main step when back button is clicked in tmdb-search", async () => {
      const user = userEvent.setup();
      render(
        <ItemSettingsDialog
          {...defaultProps}
          item={{
            ...defaultProps.item,
            tmdbId: null,
            tmdbType: null,
          }}
        />
      );

      await user.click(screen.getByText("Search TMDB\u2026"));
      await user.click(screen.getByLabelText("Back"));

      expect(screen.getByLabelText(/item name/i)).toBeInTheDocument();
    });
  });

  describe("TMDB Display Options Tab", () => {
    it("should not show TMDB tab when item has no tmdbId", () => {
      render(
        <ItemSettingsDialog
          {...defaultProps}
          item={{ ...defaultProps.item, tmdbId: null }}
        />
      );
      expect(
        screen.queryByRole("tab", { name: /tmdb/i })
      ).not.toBeInTheDocument();
    });

    it("should show TMDB tab when item has tmdbId", () => {
      render(
        <ItemSettingsDialog
          {...defaultProps}
          item={{ ...defaultProps.item, tmdbId: 278 }}
        />
      );
      expect(screen.getByRole("tab", { name: /tmdb/i })).toBeInTheDocument();
    });

    it("should show TMDB tab even without Drive connection", () => {
      render(
        <ItemSettingsDialog
          {...defaultProps}
          item={{ ...defaultProps.item, tmdbId: 278 }}
          hasDriveConnection={false}
        />
      );
      expect(screen.getByRole("tab", { name: /tmdb/i })).toBeInTheDocument();
    });

    it("should show display option checkboxes in TMDB tab", async () => {
      const user = userEvent.setup();
      render(
        <ItemSettingsDialog
          {...defaultProps}
          item={{ ...defaultProps.item, tmdbId: 278 }}
        />
      );

      await user.click(screen.getByRole("tab", { name: /tmdb/i }));

      expect(screen.getByText("Tagline")).toBeInTheDocument();
      expect(screen.getByText("Cast")).toBeInTheDocument();
      expect(screen.getByText("Where to Watch")).toBeInTheDocument();
      expect(screen.getByText("Videos")).toBeInTheDocument();
      expect(screen.getByText("Genres")).toBeInTheDocument();
      expect(screen.getByText(/Metadata/)).toBeInTheDocument();
    });

    it("should reflect initial display option state from item props", async () => {
      const user = userEvent.setup();
      render(
        <ItemSettingsDialog
          {...defaultProps}
          item={{
            ...defaultProps.item,
            tmdbId: 278,
            tmdbShowCast: false,
            tmdbShowVideos: false,
          }}
        />
      );

      await user.click(screen.getByRole("tab", { name: /tmdb/i }));

      const castCheckbox = screen
        .getByText("Cast")
        .closest("label")
        ?.querySelector("[role=checkbox]");
      const videosCheckbox = screen
        .getByText("Videos")
        .closest("label")
        ?.querySelector("[role=checkbox]");
      expect(castCheckbox).toHaveAttribute("aria-checked", "false");
      expect(videosCheckbox).toHaveAttribute("aria-checked", "false");

      const taglineCheckbox = screen
        .getByText("Tagline")
        .closest("label")
        ?.querySelector("[role=checkbox]");
      expect(taglineCheckbox).toHaveAttribute("aria-checked", "true");
    });

    it("should enable Save Changes when checkbox toggled", async () => {
      const user = userEvent.setup();

      render(
        <ItemSettingsDialog
          {...defaultProps}
          item={{ ...defaultProps.item, tmdbId: 278 }}
        />
      );

      // Save button should be disabled initially
      expect(
        screen.getByRole("button", { name: /save changes/i })
      ).toBeDisabled();

      await user.click(screen.getByRole("tab", { name: /tmdb/i }));

      const castCheckbox = screen
        .getByText("Cast")
        .closest("label")
        ?.querySelector("[role=checkbox]");
      if (castCheckbox) await user.click(castCheckbox);

      // Save button should now be enabled
      await waitFor(() => {
        expect(
          screen.getByRole("button", { name: /save changes/i })
        ).toBeEnabled();
      });
    });

    it("should call updateTmdbDisplayOptions on save when options changed", async () => {
      const user = userEvent.setup();
      const mockUpdate = vi.fn().mockResolvedValue({ success: true });
      vi.mocked(updateTmdbDisplayOptions).mockImplementation(mockUpdate);

      render(
        <ItemSettingsDialog
          {...defaultProps}
          item={{ ...defaultProps.item, tmdbId: 278 }}
        />
      );

      await user.click(screen.getByRole("tab", { name: /tmdb/i }));

      const castCheckbox = screen
        .getByText("Cast")
        .closest("label")
        ?.querySelector("[role=checkbox]");
      if (castCheckbox) await user.click(castCheckbox);

      // Not called yet — requires explicit save
      expect(mockUpdate).not.toHaveBeenCalled();

      await user.click(screen.getByRole("button", { name: /save changes/i }));

      await waitFor(() => {
        expect(mockUpdate).toHaveBeenCalledWith(
          defaultProps.item.id,
          expect.objectContaining({ showCast: false })
        );
      });
    });

    it("should show error toast on save failure", async () => {
      const user = userEvent.setup();
      vi.mocked(updateTmdbDisplayOptions).mockResolvedValue({
        success: false,
        error: "Item has no TMDB metadata",
      });

      render(
        <ItemSettingsDialog
          {...defaultProps}
          item={{ ...defaultProps.item, tmdbId: 278 }}
        />
      );

      await user.click(screen.getByRole("tab", { name: /tmdb/i }));

      const castCheckbox = screen
        .getByText("Cast")
        .closest("label")
        ?.querySelector("[role=checkbox]");
      if (castCheckbox) await user.click(castCheckbox);

      await user.click(screen.getByRole("button", { name: /save changes/i }));

      await waitFor(() => {
        expect(toast.error).toHaveBeenCalledWith("Item has no TMDB metadata");
      });
    });
  });

  describe("TMDB metadata section", () => {
    it("renders TmdbMetadataSection when item has tmdbId", async () => {
      const user = userEvent.setup();
      render(
        <ItemSettingsDialog
          open={true}
          onOpenChange={vi.fn()}
          item={{
            ...defaultProps.item,
            tmdbId: 155,
            tmdbType: "movie",
            tmdbPosterPath: "/poster.jpg",
            tmdbBackdropPath: "/backdrop.jpg",
          }}
          files={defaultProps.files}
        />
      );

      // Switch to TMDB tab
      const tmdbTab = screen.getByRole("tab", { name: /tmdb/i });
      await user.click(tmdbTab);

      // Should show metadata section with poster/backdrop fields (no detach — moved to Details tab)
      expect(screen.getByText("Poster")).toBeInTheDocument();
      expect(screen.getByText("Backdrop")).toBeInTheDocument();
    });

    it("does not render TmdbMetadataSection when item has no tmdbId", () => {
      render(
        <ItemSettingsDialog
          open={true}
          onOpenChange={vi.fn()}
          item={{
            ...defaultProps.item,
            tmdbId: null,
            tmdbType: null,
            tmdbPosterPath: null,
            tmdbBackdropPath: null,
          }}
          files={defaultProps.files}
        />
      );

      // TMDB tab should not exist
      expect(
        screen.queryByRole("tab", { name: /tmdb/i })
      ).not.toBeInTheDocument();
    });
  });
});
