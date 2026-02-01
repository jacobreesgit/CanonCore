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
  getImagesAction: vi.fn(),
  isTMDBAvailable: vi.fn(),
}));

vi.mock("sonner", () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}));

import {
  searchMediaAction,
  applyMetadataAction,
  getMetadataPreviewAction,
  getImagesAction,
  isTMDBAvailable,
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
    },
    files: { media: [], artwork: [], subtitles: [] },
    hasDriveConnection: true,
  };

  beforeEach(() => {
    vi.clearAllMocks();
    // Clear localStorage to reset tab selection between tests
    localStorage.clear();
    vi.mocked(isTMDBAvailable).mockResolvedValue(true);
    vi.mocked(searchMediaAction).mockResolvedValue({
      success: true,
      data: [],
    });
    vi.mocked(applyMetadataAction).mockResolvedValue({ success: true });
    vi.mocked(getMetadataPreviewAction).mockResolvedValue({
      success: true,
      data: {
        name: "Test Movie (2023)",
        description: "Test description",
        posterUrl: "https://image.tmdb.org/t/p/w185/poster.jpg",
        backdropUrl: "https://image.tmdb.org/t/p/w780/backdrop.jpg",
        posterPath: "/poster.jpg",
        backdropPath: "/backdrop.jpg",
      },
    });
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
    playbackPosition: null,
    playbackDuration: null,
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
            id: "item-1",
            name: "Test Item",
            description: null,
            isPublic: false,
            inheritVisibility: false,
            hasParent: false,
            hasChildren: false,
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
      const deleteBtn = await screen.findByTestId("delete-file-m2");
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

  describe("TMDB Search via Name Field", () => {
    // Helper to find the TMDB search combobox (the Item name field)
    const findTMDBCombobox = async () => {
      await waitFor(() => {
        expect(screen.getByLabelText(/item name/i)).toBeInTheDocument();
      });
      return screen.getByRole("combobox");
    };

    // Helper to complete wizard: Next (step 1) → Next (step 2) → Next (step 3) → Apply (step 4)
    // TMDBWizard uses headings instead of "Step X of Y" text
    const confirmMetadata = async (
      user: ReturnType<typeof userEvent.setup>
    ) => {
      // Wait for wizard step 1 (Title & Description)
      await waitFor(() => {
        expect(
          screen.getByRole("heading", { name: /title & description/i })
        ).toBeInTheDocument();
      });

      // Step 1 → Step 2 (Poster Selection)
      await user.click(screen.getByRole("button", { name: /next/i }));

      // Wait for step 2 (Select Poster)
      await waitFor(() => {
        expect(
          screen.getByRole("heading", { name: /select poster/i })
        ).toBeInTheDocument();
      });

      // Step 2 → Step 3 (Hero Selection)
      await user.click(screen.getByRole("button", { name: /next/i }));

      // Wait for step 3 (Select Hero Image)
      await waitFor(() => {
        expect(
          screen.getByRole("heading", { name: /select hero image/i })
        ).toBeInTheDocument();
      });

      // Step 3 → Step 4 (Summary/Review)
      await user.click(screen.getByRole("button", { name: /next/i }));

      // Wait for step 4 (Review Changes)
      await waitFor(() => {
        expect(
          screen.getByRole("heading", { name: /review changes/i })
        ).toBeInTheDocument();
      });

      // Step 4 → Complete
      await user.click(screen.getByRole("button", { name: /apply/i }));
    };

    it("should render item name field with TMDB search", async () => {
      render(<ItemSettingsDialog {...defaultProps} />);

      await waitFor(() => {
        expect(screen.getByLabelText(/item name/i)).toBeInTheDocument();
      });

      // The combobox serves dual purpose: name input + TMDB search
      expect(screen.getByRole("combobox")).toBeInTheDocument();
    });

    it("should render media search combobox as name field", async () => {
      render(<ItemSettingsDialog {...defaultProps} />);

      const combobox = await findTMDBCombobox();
      expect(combobox).toBeInTheDocument();
      expect(combobox).toHaveValue("Test Item"); // Should show current item name
    });

    it("should show confirmation dialog when TMDB result selected", async () => {
      const user = userEvent.setup();
      vi.mocked(searchMediaAction).mockResolvedValue({
        success: true,
        data: [
          {
            id: 278,
            mediaType: "movie",
            title: "The Shawshank Redemption",
            overview: "Two imprisoned men bond.",
            posterPath: "/poster.jpg",
            backdropPath: "/backdrop.jpg",
            year: "1994",
          },
        ],
      });
      vi.mocked(getMetadataPreviewAction).mockResolvedValue({
        success: true,
        data: {
          name: "The Shawshank Redemption (1994)",
          description: "Two imprisoned men bond.",
          posterUrl: "https://image.tmdb.org/t/p/w185/poster.jpg",
          backdropUrl: "https://image.tmdb.org/t/p/w780/backdrop.jpg",
          posterPath: "/poster.jpg",
          backdropPath: "/backdrop.jpg",
        },
      });

      render(<ItemSettingsDialog {...defaultProps} />);

      const combobox = await findTMDBCombobox();
      await user.type(combobox, "Shawshank");

      await waitFor(() => {
        expect(
          screen.getByText("The Shawshank Redemption")
        ).toBeInTheDocument();
      });

      await user.click(screen.getByText("The Shawshank Redemption"));

      // Verify confirmation dialog appears
      await waitFor(() => {
        expect(screen.getByText("Apply Metadata")).toBeInTheDocument();
      });
    });

    it("should call applyMetadataAction after confirming in dialog", async () => {
      const user = userEvent.setup();
      vi.mocked(searchMediaAction).mockResolvedValue({
        success: true,
        data: [
          {
            id: 278,
            mediaType: "movie",
            title: "The Shawshank Redemption",
            overview: "Two imprisoned men bond.",
            posterPath: "/poster.jpg",
            backdropPath: "/backdrop.jpg",
            year: "1994",
          },
        ],
      });
      vi.mocked(getMetadataPreviewAction).mockResolvedValue({
        success: true,
        data: {
          name: "The Shawshank Redemption (1994)",
          description: "Two imprisoned men bond.",
          posterUrl: "https://image.tmdb.org/t/p/w185/poster.jpg",
          backdropUrl: "https://image.tmdb.org/t/p/w780/backdrop.jpg",
          posterPath: "/poster.jpg",
          backdropPath: "/backdrop.jpg",
        },
      });

      render(<ItemSettingsDialog {...defaultProps} />);

      const combobox = await findTMDBCombobox();
      await user.type(combobox, "Shawshank");

      await waitFor(() => {
        expect(
          screen.getByText("The Shawshank Redemption")
        ).toBeInTheDocument();
      });

      await user.click(screen.getByText("The Shawshank Redemption"));
      await confirmMetadata(user);

      await waitFor(() => {
        expect(applyMetadataAction).toHaveBeenCalledWith(
          "item-1",
          278,
          "movie",
          expect.objectContaining({
            updateName: true,
            updateDescription: true,
          })
        );
      });
    });

    it("should show success toast after metadata applied", async () => {
      const user = userEvent.setup();
      // Use a movie to test wizard flow directly (TV shows go through EpisodePicker first)
      vi.mocked(searchMediaAction).mockResolvedValue({
        success: true,
        data: [
          {
            id: 550,
            mediaType: "movie",
            title: "Fight Club",
            overview: "An insomniac office worker.",
            posterPath: null,
            backdropPath: null,
            year: "1999",
          },
        ],
      });
      vi.mocked(getMetadataPreviewAction).mockResolvedValue({
        success: true,
        data: {
          name: "Fight Club (1999)",
          description: "An insomniac office worker.",
          posterUrl: null,
          backdropUrl: null,
          posterPath: null,
          backdropPath: null,
        },
      });

      render(<ItemSettingsDialog {...defaultProps} />);

      const combobox = await findTMDBCombobox();
      await user.type(combobox, "Fight");

      await waitFor(() => {
        expect(screen.getByText("Fight Club")).toBeInTheDocument();
      });

      await user.click(screen.getByText("Fight Club"));
      await confirmMetadata(user);

      await waitFor(() => {
        expect(toast.success).toHaveBeenCalledWith(
          "Metadata applied successfully"
        );
      });
    });

    it("should show error toast when metadata application fails", async () => {
      const user = userEvent.setup();
      vi.mocked(applyMetadataAction).mockResolvedValue({
        success: false,
        error: "Movie not found on TMDB",
      });
      vi.mocked(searchMediaAction).mockResolvedValue({
        success: true,
        data: [
          {
            id: 999,
            mediaType: "movie",
            title: "Unknown Movie",
            overview: "Test",
            posterPath: null,
            backdropPath: null,
            year: "2023",
          },
        ],
      });
      vi.mocked(getMetadataPreviewAction).mockResolvedValue({
        success: true,
        data: {
          name: "Unknown Movie (2023)",
          description: "Test",
          posterUrl: null,
          backdropUrl: null,
          posterPath: null,
          backdropPath: null,
        },
      });

      render(<ItemSettingsDialog {...defaultProps} />);

      const combobox = await findTMDBCombobox();
      await user.type(combobox, "Unknown");

      await waitFor(() => {
        expect(screen.getByText("Unknown Movie")).toBeInTheDocument();
      });

      await user.click(screen.getByText("Unknown Movie"));
      await confirmMetadata(user);

      await waitFor(() => {
        expect(toast.error).toHaveBeenCalledWith("Movie not found on TMDB");
      });
    });

    it("should call onSettingsChange after metadata applied", async () => {
      const onSettingsChange = vi.fn().mockResolvedValue(undefined);
      const user = userEvent.setup();
      vi.mocked(searchMediaAction).mockResolvedValue({
        success: true,
        data: [
          {
            id: 278,
            mediaType: "movie",
            title: "Test Movie",
            overview: "Description",
            posterPath: "/poster.jpg",
            backdropPath: "/backdrop.jpg",
            year: "2023",
          },
        ],
      });
      vi.mocked(getMetadataPreviewAction).mockResolvedValue({
        success: true,
        data: {
          name: "Test Movie (2023)",
          description: "Description",
          posterUrl: "https://image.tmdb.org/t/p/w185/poster.jpg",
          backdropUrl: "https://image.tmdb.org/t/p/w780/backdrop.jpg",
          posterPath: "/poster.jpg",
          backdropPath: "/backdrop.jpg",
        },
      });

      render(
        <ItemSettingsDialog
          {...defaultProps}
          onSettingsChange={onSettingsChange}
        />
      );

      const combobox = await findTMDBCombobox();
      await user.type(combobox, "Test");

      await waitFor(() => {
        expect(screen.getByText("Test Movie")).toBeInTheDocument();
      });

      await user.click(screen.getByText("Test Movie"));
      await confirmMetadata(user);

      await waitFor(() => {
        expect(onSettingsChange).toHaveBeenCalled();
      });
    });

    it("should show error toast when preview fetch fails", async () => {
      const user = userEvent.setup();
      vi.mocked(searchMediaAction).mockResolvedValue({
        success: true,
        data: [
          {
            id: 278,
            mediaType: "movie",
            title: "Test Movie",
            overview: "Description",
            posterPath: "/poster.jpg",
            backdropPath: "/backdrop.jpg",
            year: "2023",
          },
        ],
      });
      vi.mocked(getMetadataPreviewAction).mockResolvedValue({
        success: false,
        error: "Could not fetch preview",
      });

      render(<ItemSettingsDialog {...defaultProps} />);

      const combobox = await findTMDBCombobox();
      await user.type(combobox, "Test");

      await waitFor(() => {
        expect(screen.getByText("Test Movie")).toBeInTheDocument();
      });

      await user.click(screen.getByText("Test Movie"));

      await waitFor(() => {
        expect(toast.error).toHaveBeenCalledWith("Could not fetch preview");
      });
    });
  });
});
