/**
 * Tests for TMDB wizard integration in AddItemDialog.
 * Verifies the new TMDBWizard component is used for metadata selection.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { AddItemDialog } from "@/components/items/add-item-dialog";

// Mock TMDB actions
vi.mock("@/lib/tmdb-actions", () => ({
  searchMediaAction: vi.fn(),
  isTMDBAvailable: vi.fn(),
  getMetadataPreviewAction: vi.fn(),
  getImagesAction: vi.fn(),
  getEpisodePreviewAction: vi.fn(),
  getSeasonsAction: vi.fn(),
  getEpisodesAction: vi.fn(),
}));

// Mock sonner toast
vi.mock("sonner", () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
  },
}));

// Mock Google Drive upload
vi.mock("@/lib/google-drive-upload", () => ({
  createUploadSessions: vi.fn(),
  confirmUpload: vi.fn(),
}));

import {
  searchMediaAction,
  isTMDBAvailable,
  getMetadataPreviewAction,
  getImagesAction,
} from "@/lib/tmdb-actions";

describe("AddItemDialog TMDB Wizard Integration", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
    vi.mocked(isTMDBAvailable).mockResolvedValue(true);
    vi.mocked(searchMediaAction).mockResolvedValue({
      success: true,
      data: [],
    });
  });

  it("uses WizardStepIndicator when in TMDB wizard flow", async () => {
    const user = userEvent.setup();

    // Setup TMDB search result (movie for direct wizard entry)
    vi.mocked(searchMediaAction).mockResolvedValue({
      success: true,
      data: [
        {
          id: 550,
          mediaType: "movie",
          title: "Fight Club",
          overview: "An insomniac office worker...",
          posterPath: "/poster.jpg",
          backdropPath: "/backdrop.jpg",
          year: "1999",
        },
      ],
    });
    vi.mocked(getMetadataPreviewAction).mockResolvedValue({
      success: true,
      data: {
        name: "Fight Club (1999)",
        description: "An insomniac office worker...",
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
            vote_average: 8,
            iso_639_1: "en",
            width: 500,
            height: 750,
          },
        ],
        backdrops: [
          {
            file_path: "/backdrop.jpg",
            vote_average: 9,
            iso_639_1: null,
            width: 1920,
            height: 1080,
          },
        ],
      },
    });

    render(
      <AddItemDialog
        open={true}
        onOpenChange={() => {}}
        onAdd={async () => ({ itemId: "test-id" })}
        hasDriveConnection={true}
      />
    );

    // Wait for dialog to be ready
    await waitFor(() => {
      expect(screen.getByRole("combobox")).toBeInTheDocument();
    });

    // Search for a movie
    await user.type(screen.getByRole("combobox"), "Fight");

    // Wait for and select the search result
    await waitFor(() => {
      expect(screen.getByText("Fight Club")).toBeInTheDocument();
    });
    await user.click(screen.getByText("Fight Club"));

    // Wait for wizard to appear - AddItemDialog renders its own step progress bar
    // in the dialog header (via onHeaderChange callback), not the inline WizardStepIndicator
    await waitFor(() => {
      expect(screen.getByRole("status")).toHaveTextContent(/Step 1 of 4/);
    });
  });

  it("navigates through wizard steps using TMDBWizard component", async () => {
    const user = userEvent.setup();

    vi.mocked(searchMediaAction).mockResolvedValue({
      success: true,
      data: [
        {
          id: 550,
          mediaType: "movie",
          title: "Fight Club",
          overview: "An insomniac office worker...",
          posterPath: "/poster.jpg",
          backdropPath: "/backdrop.jpg",
          year: "1999",
        },
      ],
    });
    vi.mocked(getMetadataPreviewAction).mockResolvedValue({
      success: true,
      data: {
        name: "Fight Club (1999)",
        description: "An insomniac office worker...",
        posterUrl: null,
        backdropUrl: null,
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
            vote_average: 8,
            iso_639_1: "en",
            width: 500,
            height: 750,
          },
        ],
        backdrops: [
          {
            file_path: "/backdrop.jpg",
            vote_average: 9,
            iso_639_1: null,
            width: 1920,
            height: 1080,
          },
        ],
      },
    });

    render(
      <AddItemDialog
        open={true}
        onOpenChange={() => {}}
        onAdd={async () => ({ itemId: "test-id" })}
        hasDriveConnection={true}
      />
    );

    await waitFor(() => {
      expect(screen.getByRole("combobox")).toBeInTheDocument();
    });

    await user.type(screen.getByRole("combobox"), "Fight");
    await waitFor(() => {
      expect(screen.getByText("Fight Club")).toBeInTheDocument();
    });
    await user.click(screen.getByText("Fight Club"));

    // Step 1: Title & Description (use heading query to be more specific)
    await waitFor(() => {
      expect(
        screen.getByRole("heading", { name: /title & description/i })
      ).toBeInTheDocument();
    });

    // Click Next to go to poster step
    await user.click(screen.getByRole("button", { name: /next/i }));

    // Step 2: Poster
    await waitFor(() => {
      expect(
        screen.getByRole("heading", { name: /select poster/i })
      ).toBeInTheDocument();
    });

    // Click Next to go to hero step
    await user.click(screen.getByRole("button", { name: /next/i }));

    // Step 3: Hero Image
    await waitFor(() => {
      expect(
        screen.getByRole("heading", { name: /select hero image/i })
      ).toBeInTheDocument();
    });

    // Click Next to go to summary/review step
    await user.click(screen.getByRole("button", { name: /next/i }));

    // Step 4: Review Changes
    await waitFor(() => {
      expect(
        screen.getByRole("heading", { name: /review changes/i })
      ).toBeInTheDocument();
    });
  });

  it("applies wizard result and shows final form after wizard completion", async () => {
    const user = userEvent.setup();

    vi.mocked(searchMediaAction).mockResolvedValue({
      success: true,
      data: [
        {
          id: 550,
          mediaType: "movie",
          title: "Fight Club",
          overview: "An insomniac office worker...",
          posterPath: "/poster.jpg",
          backdropPath: "/backdrop.jpg",
          year: "1999",
        },
      ],
    });
    vi.mocked(getMetadataPreviewAction).mockResolvedValue({
      success: true,
      data: {
        name: "Fight Club (1999)",
        description:
          "An insomniac office worker forms an underground fight club.",
        posterUrl: null,
        backdropUrl: null,
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
            vote_average: 8,
            iso_639_1: "en",
            width: 500,
            height: 750,
          },
        ],
        backdrops: [
          {
            file_path: "/backdrop.jpg",
            vote_average: 9,
            iso_639_1: null,
            width: 1920,
            height: 1080,
          },
        ],
      },
    });

    render(
      <AddItemDialog
        open={true}
        onOpenChange={() => {}}
        onAdd={async () => ({ itemId: "test-id" })}
        hasDriveConnection={true}
      />
    );

    await waitFor(() => {
      expect(screen.getByRole("combobox")).toBeInTheDocument();
    });

    await user.type(screen.getByRole("combobox"), "Fight");
    await waitFor(() => {
      expect(screen.getByText("Fight Club")).toBeInTheDocument();
    });
    await user.click(screen.getByText("Fight Club"));

    // Navigate through wizard steps
    await waitFor(() => {
      expect(
        screen.getByRole("heading", { name: /title & description/i })
      ).toBeInTheDocument();
    });
    await user.click(screen.getByRole("button", { name: /next/i }));

    await waitFor(() => {
      expect(
        screen.getByRole("heading", { name: /select poster/i })
      ).toBeInTheDocument();
    });
    await user.click(screen.getByRole("button", { name: /next/i }));

    await waitFor(() => {
      expect(
        screen.getByRole("heading", { name: /select hero image/i })
      ).toBeInTheDocument();
    });
    await user.click(screen.getByRole("button", { name: /next/i }));

    // Click Apply in review step
    await waitFor(() => {
      expect(
        screen.getByRole("heading", { name: /review changes/i })
      ).toBeInTheDocument();
    });
    await user.click(screen.getByRole("button", { name: /apply/i }));

    // After wizard completes, should show final form with applied values
    await waitFor(() => {
      // The final form should have the name filled in
      const nameInput = screen.getByRole("combobox");
      expect(nameInput).toHaveValue("Fight Club (1999)");
    });
  });

  it("shows all steps even without Drive connection", async () => {
    const user = userEvent.setup();

    vi.mocked(searchMediaAction).mockResolvedValue({
      success: true,
      data: [
        {
          id: 550,
          mediaType: "movie",
          title: "Fight Club",
          overview: "An insomniac office worker...",
          posterPath: "/poster.jpg",
          backdropPath: "/backdrop.jpg",
          year: "1999",
        },
      ],
    });
    vi.mocked(getMetadataPreviewAction).mockResolvedValue({
      success: true,
      data: {
        name: "Fight Club (1999)",
        description: "An insomniac office worker...",
        posterUrl: null,
        backdropUrl: null,
        posterPath: null,
        backdropPath: null,
      },
    });

    render(
      <AddItemDialog
        open={true}
        onOpenChange={() => {}}
        onAdd={async () => ({ itemId: "test-id" })}
        hasDriveConnection={false}
      />
    );

    await waitFor(() => {
      expect(screen.getByRole("combobox")).toBeInTheDocument();
    });

    await user.type(screen.getByRole("combobox"), "Fight");
    await waitFor(() => {
      expect(screen.getByText("Fight Club")).toBeInTheDocument();
    });
    await user.click(screen.getByText("Fight Club"));

    // Without Drive connection, wizard still shows all 4 steps
    // (TMDB images served from CDN, no Drive needed)
    // AddItemDialog renders step progress in header via onHeaderChange callback
    await waitFor(() => {
      expect(screen.getByRole("status")).toHaveTextContent(/Step 1 of 4/);
    });
  });
});
