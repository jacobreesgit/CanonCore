/**
 * Unit tests for AddItemDialog component.
 * Tests dialog rendering, form validation, submission behavior, and TMDB integration.
 */

import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { AddItemDialog } from "@/components/items/add-item-dialog";

// Mock TMDB actions
vi.mock("@/lib/tmdb-actions", () => ({
  searchMediaAction: vi.fn(),
  isTMDBAvailable: vi.fn(),
  getMetadataPreviewAction: vi.fn(),
  getImagesAction: vi.fn(),
  getEpisodePreviewAction: vi.fn(),
}));

import {
  searchMediaAction,
  isTMDBAvailable,
  getMetadataPreviewAction,
  getImagesAction,
  getEpisodePreviewAction,
} from "@/lib/tmdb-actions";

describe("AddItemDialog", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Clear localStorage to reset tab persistence between tests
    localStorage.clear();
    vi.mocked(isTMDBAvailable).mockResolvedValue(true);
    vi.mocked(searchMediaAction).mockResolvedValue({
      success: true,
      data: [],
    });
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
    vi.mocked(getEpisodePreviewAction).mockResolvedValue({
      success: true,
      data: {
        name: "Episode 1 - Pilot",
        description: "The first episode of the series.",
        stillUrl: null,
        stillPath: null,
        seasonNumber: 1,
        episodeNumber: 1,
      },
    });
  });

  /** Helper to complete wizard: Next (step 1) → Next (step 2) → Apply (step 3) → Summary (step 4) */
  // Note: AnimatedDialogContent uses AnimatePresence mode="sync" for crossfade,
  // so we must wait for old step to fully exit before querying Next button
  const completeWizard = async (user: ReturnType<typeof userEvent.setup>) => {
    // Wait for wizard step 1 to appear
    await waitFor(() => {
      expect(screen.getByText("Apply Metadata")).toBeInTheDocument();
      expect(screen.getByText(/Step 1 of 4/i)).toBeInTheDocument();
    });

    // Step 1 → Step 2
    await user.click(screen.getByRole("button", { name: /next/i }));

    // Wait for step 2 AND ensure step 1 is fully gone (animation complete)
    await waitFor(() => {
      expect(screen.getByText(/Step 2 of 4/i)).toBeInTheDocument();
      expect(screen.queryByText(/Step 1 of 4/i)).not.toBeInTheDocument();
    });

    // Step 2 → Step 3
    await user.click(screen.getByRole("button", { name: /next/i }));

    // Wait for step 3 AND ensure step 2 is fully gone
    await waitFor(() => {
      expect(screen.getByText(/Step 3 of 4/i)).toBeInTheDocument();
      expect(screen.queryByText(/Step 2 of 4/i)).not.toBeInTheDocument();
    });

    // Step 3 → Step 4 (Summary)
    await user.click(screen.getByRole("button", { name: /apply/i }));

    // Wait for step 4 (wizard-summary) AND ensure step 3 is fully gone
    await waitFor(() => {
      expect(screen.getByText(/Step 4 of 4/i)).toBeInTheDocument();
      expect(screen.queryByText(/Step 3 of 4/i)).not.toBeInTheDocument();
    });
  };

  it("renders dialog when open", async () => {
    render(
      <AddItemDialog
        open={true}
        onOpenChange={() => {}}
        onAdd={async () => undefined}
      />
    );

    expect(screen.getByRole("dialog")).toBeInTheDocument();
    expect(screen.getByText("Create Item")).toBeInTheDocument();

    // Wait for TMDB check to complete
    await waitFor(() => {
      expect(screen.getByRole("combobox")).toBeInTheDocument();
    });
  });

  it("does not render when closed", () => {
    render(
      <AddItemDialog
        open={false}
        onOpenChange={() => {}}
        onAdd={async () => undefined}
      />
    );

    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("renders search combobox on open", async () => {
    render(
      <AddItemDialog
        open={true}
        onOpenChange={() => {}}
        onAdd={async () => undefined}
      />
    );

    await waitFor(() => {
      expect(screen.getByRole("combobox")).toBeInTheDocument();
    });

    // Verify the combobox is accessible and ready for input
    const input = screen.getByRole("combobox");
    expect(input).toHaveAttribute("aria-haspopup", "listbox");
  });

  it("disables create button when input is empty", async () => {
    render(
      <AddItemDialog
        open={true}
        onOpenChange={() => {}}
        onAdd={async () => undefined}
      />
    );

    await waitFor(() => {
      expect(screen.getByRole("combobox")).toBeInTheDocument();
    });

    const button = screen.getByRole("button", { name: /^create$/i });
    expect(button).toBeDisabled();
  });

  it("calls onAdd with trimmed item name on submit", async () => {
    const user = userEvent.setup();
    const onAdd = vi.fn().mockResolvedValue(undefined);

    render(<AddItemDialog open={true} onOpenChange={() => {}} onAdd={onAdd} />);

    await waitFor(() => {
      expect(screen.getByRole("combobox")).toBeInTheDocument();
    });

    await user.type(screen.getByRole("combobox"), "  New Item  ");
    await user.click(screen.getByRole("button", { name: /^create$/i }));

    await waitFor(() => {
      expect(onAdd).toHaveBeenCalledWith(
        "New Item",
        undefined,
        undefined,
        undefined
      );
    });
  });

  it("closes dialog on successful creation", async () => {
    const user = userEvent.setup();
    const onAdd = vi.fn().mockResolvedValue(undefined);
    const onOpenChange = vi.fn();

    render(
      <AddItemDialog open={true} onOpenChange={onOpenChange} onAdd={onAdd} />
    );

    await waitFor(() => {
      expect(screen.getByRole("combobox")).toBeInTheDocument();
    });

    await user.type(screen.getByRole("combobox"), "New Item");
    await user.click(screen.getByRole("button", { name: /^create$/i }));

    await waitFor(() => {
      expect(onOpenChange).toHaveBeenCalledWith(false);
    });
  });

  it("keeps dialog open on error", async () => {
    const user = userEvent.setup();
    const onAdd = vi.fn().mockResolvedValue("Error message");
    const onOpenChange = vi.fn();

    render(
      <AddItemDialog open={true} onOpenChange={onOpenChange} onAdd={onAdd} />
    );

    await waitFor(() => {
      expect(screen.getByRole("combobox")).toBeInTheDocument();
    });

    await user.type(screen.getByRole("combobox"), "New Item");
    await user.click(screen.getByRole("button", { name: /^create$/i }));

    await waitFor(() => {
      expect(onAdd).toHaveBeenCalled();
    });
    expect(onOpenChange).not.toHaveBeenCalledWith(false);
  });

  it("allows manual text entry when typing", async () => {
    const user = userEvent.setup();
    const onAdd = vi.fn().mockResolvedValue(undefined);

    render(<AddItemDialog open={true} onOpenChange={() => {}} onAdd={onAdd} />);

    await waitFor(() => {
      expect(screen.getByRole("combobox")).toBeInTheDocument();
    });

    await user.type(screen.getByRole("combobox"), "Custom Item Name");
    await user.click(screen.getByRole("button", { name: /^create$/i }));

    await waitFor(() => {
      expect(onAdd).toHaveBeenCalledWith(
        "Custom Item Name",
        undefined,
        undefined,
        undefined
      );
    });
  });

  it("clears input when dialog reopens", async () => {
    const { rerender } = render(
      <AddItemDialog
        open={false}
        onOpenChange={() => {}}
        onAdd={async () => undefined}
      />
    );

    rerender(
      <AddItemDialog
        open={true}
        onOpenChange={() => {}}
        onAdd={async () => undefined}
      />
    );

    await waitFor(() => {
      expect(screen.getByRole("combobox")).toBeInTheDocument();
    });

    expect(screen.getByRole("combobox")).toHaveValue("");
  });

  it("shows loading state during submission", async () => {
    const user = userEvent.setup();
    let resolveAdd: (value: string | undefined) => void;
    const onAdd = vi.fn().mockImplementation(
      () =>
        new Promise((resolve) => {
          resolveAdd = resolve;
        })
    );

    render(<AddItemDialog open={true} onOpenChange={() => {}} onAdd={onAdd} />);

    await waitFor(() => {
      expect(screen.getByRole("combobox")).toBeInTheDocument();
    });

    await user.type(screen.getByRole("combobox"), "New Item");
    await user.click(screen.getByRole("button", { name: /^create$/i }));

    expect(screen.getByRole("button", { name: /creating/i })).toBeDisabled();

    // Resolve the promise and wait for the component to update
    await waitFor(() => {
      resolveAdd!(undefined);
    });
  });

  it("closes dialog when Cancel button is clicked", async () => {
    const user = userEvent.setup();
    const onOpenChange = vi.fn();

    render(
      <AddItemDialog
        open={true}
        onOpenChange={onOpenChange}
        onAdd={async () => undefined}
      />
    );

    await waitFor(() => {
      expect(screen.getByRole("combobox")).toBeInTheDocument();
    });

    await user.click(screen.getByRole("button", { name: /cancel/i }));

    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it("does not submit when input is only whitespace", async () => {
    const user = userEvent.setup();

    render(
      <AddItemDialog
        open={true}
        onOpenChange={() => {}}
        onAdd={async () => undefined}
      />
    );

    await waitFor(() => {
      expect(screen.getByRole("combobox")).toBeInTheDocument();
    });

    await user.type(screen.getByRole("combobox"), "   ");

    expect(screen.getByRole("button", { name: /^create$/i })).toBeDisabled();
  });

  it("shows parent item context in description", async () => {
    render(
      <AddItemDialog
        open={true}
        onOpenChange={() => {}}
        onAdd={async () => undefined}
        parentName="Movies"
      />
    );

    await waitFor(() => {
      expect(screen.getByRole("combobox")).toBeInTheDocument();
    });

    expect(
      screen.getByText(/create a new item inside "Movies"/i)
    ).toBeInTheDocument();
  });

  it("renders description field", async () => {
    render(
      <AddItemDialog
        open={true}
        onOpenChange={() => {}}
        onAdd={async () => undefined}
      />
    );

    await waitFor(() => {
      expect(screen.getByRole("combobox")).toBeInTheDocument();
    });

    expect(screen.getByLabelText(/description/i)).toBeInTheDocument();
    expect(screen.getByText("0/1000 characters")).toBeInTheDocument();
  });

  it("passes description to onAdd when provided", async () => {
    const user = userEvent.setup();
    const onAdd = vi.fn().mockResolvedValue(undefined);

    render(<AddItemDialog open={true} onOpenChange={() => {}} onAdd={onAdd} />);

    await waitFor(() => {
      expect(screen.getByRole("combobox")).toBeInTheDocument();
    });

    await user.type(screen.getByRole("combobox"), "New Item");
    await user.type(
      screen.getByPlaceholderText(/add a short description/i),
      "My item description"
    );
    await user.click(screen.getByRole("button", { name: /^create$/i }));

    await waitFor(() => {
      expect(onAdd).toHaveBeenCalledWith(
        "New Item",
        "My item description",
        undefined,
        undefined
      );
    });
  });

  it("trims description whitespace", async () => {
    const user = userEvent.setup();
    const onAdd = vi.fn().mockResolvedValue(undefined);

    render(<AddItemDialog open={true} onOpenChange={() => {}} onAdd={onAdd} />);

    await waitFor(() => {
      expect(screen.getByRole("combobox")).toBeInTheDocument();
    });

    await user.type(screen.getByRole("combobox"), "New Item");
    await user.type(
      screen.getByPlaceholderText(/add a short description/i),
      "  Trimmed description  "
    );
    await user.click(screen.getByRole("button", { name: /^create$/i }));

    await waitFor(() => {
      expect(onAdd).toHaveBeenCalledWith(
        "New Item",
        "Trimmed description",
        undefined,
        undefined
      );
    });
  });

  it("shows character count for description", async () => {
    const user = userEvent.setup();

    render(
      <AddItemDialog
        open={true}
        onOpenChange={() => {}}
        onAdd={async () => undefined}
      />
    );

    await waitFor(() => {
      expect(screen.getByRole("combobox")).toBeInTheDocument();
    });

    await user.type(
      screen.getByPlaceholderText(/add a short description/i),
      "Hello"
    );

    expect(screen.getByText("5/1000 characters")).toBeInTheDocument();
  });

  it("auto-fills form when TMDB result is selected", async () => {
    const user = userEvent.setup();
    // Use a movie to test wizard flow directly (TV shows go through EpisodePicker first)
    vi.mocked(searchMediaAction).mockResolvedValue({
      success: true,
      data: [
        {
          id: 550,
          mediaType: "movie",
          title: "Fight Club",
          overview:
            "An insomniac office worker forms an underground fight club.",
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
        posterUrl: "https://image.tmdb.org/t/p/w185/poster.jpg",
        backdropUrl: "https://image.tmdb.org/t/p/w780/backdrop.jpg",
        posterPath: "/poster.jpg",
        backdropPath: "/backdrop.jpg",
      },
    });

    render(
      <AddItemDialog
        open={true}
        onOpenChange={() => {}}
        onAdd={async () => undefined}
      />
    );

    await waitFor(() => {
      expect(screen.getByRole("combobox")).toBeInTheDocument();
    });

    const input = screen.getByRole("combobox");
    await user.type(input, "Fight");

    await waitFor(() => {
      expect(screen.getByText("Fight Club")).toBeInTheDocument();
    });

    await user.click(screen.getByText("Fight Club"));

    // Complete the 3-step wizard
    await completeWizard(user);

    // Verify form fields were auto-filled
    // Note: Re-query elements after wizard completes since AnimatedDialogContent
    // re-renders the entire content, potentially creating new DOM elements.
    // After wizard completion, the summary view is shown which uses a different placeholder.
    await waitFor(() => {
      const nameInput = screen.getByRole("combobox");
      expect(nameInput).toHaveValue("Fight Club (1999)");
    });
    expect(
      screen.getByPlaceholderText(/optional description or notes/i)
    ).toHaveValue(
      "An insomniac office worker forms an underground fight club."
    );
  });

  it("submits with auto-filled data from TMDB", async () => {
    const user = userEvent.setup();
    const onAdd = vi.fn().mockResolvedValue(undefined);
    vi.mocked(searchMediaAction).mockResolvedValue({
      success: true,
      data: [
        {
          id: 278,
          mediaType: "movie",
          title: "The Shawshank Redemption",
          overview: "Two imprisoned men bond over a number of years.",
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
        description: "Two imprisoned men bond over a number of years.",
        posterUrl: "https://image.tmdb.org/t/p/w185/poster.jpg",
        backdropUrl: "https://image.tmdb.org/t/p/w780/backdrop.jpg",
        posterPath: "/poster.jpg",
        backdropPath: "/backdrop.jpg",
      },
    });

    render(<AddItemDialog open={true} onOpenChange={() => {}} onAdd={onAdd} />);

    await waitFor(() => {
      expect(screen.getByRole("combobox")).toBeInTheDocument();
    });

    await user.type(screen.getByRole("combobox"), "Shawshank");

    await waitFor(() => {
      expect(screen.getByText("The Shawshank Redemption")).toBeInTheDocument();
    });

    await user.click(screen.getByText("The Shawshank Redemption"));

    // Complete the 3-step wizard
    await completeWizard(user);

    // Now click Create
    await waitFor(() => {
      expect(
        screen.getByRole("button", { name: /^create$/i })
      ).not.toBeDisabled();
    });
    await user.click(screen.getByRole("button", { name: /^create$/i }));

    await waitFor(() => {
      expect(onAdd).toHaveBeenCalledWith(
        "The Shawshank Redemption (1994)",
        "Two imprisoned men bond over a number of years.",
        undefined,
        expect.objectContaining({
          tmdbId: 278,
          mediaType: "movie",
        })
      );
    });
  });

  it("auto-fills title without year when year is not available", async () => {
    const user = userEvent.setup();
    vi.mocked(searchMediaAction).mockResolvedValue({
      success: true,
      data: [
        {
          id: 123,
          mediaType: "movie",
          title: "Unknown Movie",
          overview: "No year available.",
          posterPath: null,
          backdropPath: null,
          year: "",
        },
      ],
    });
    vi.mocked(getMetadataPreviewAction).mockResolvedValue({
      success: true,
      data: {
        name: "Unknown Movie",
        description: "No year available.",
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
        onAdd={async () => undefined}
      />
    );

    await waitFor(() => {
      expect(screen.getByRole("combobox")).toBeInTheDocument();
    });

    await user.type(screen.getByRole("combobox"), "Unknown");

    await waitFor(() => {
      expect(screen.getByText("Unknown Movie")).toBeInTheDocument();
    });

    await user.click(screen.getByText("Unknown Movie"));

    // Complete the 3-step wizard
    await completeWizard(user);

    await waitFor(() => {
      expect(screen.getByRole("combobox")).toHaveValue("Unknown Movie");
    });
  });

  it("falls back to manual input when TMDB not configured", async () => {
    vi.mocked(isTMDBAvailable).mockResolvedValue(false);

    render(
      <AddItemDialog
        open={true}
        onOpenChange={() => {}}
        onAdd={async () => undefined}
      />
    );

    await waitFor(() => {
      expect(
        screen.getByPlaceholderText(/enter name manually/i)
      ).toBeInTheDocument();
    });
  });
});

describe("AddItemDialog - Categorized File Uploads", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Clear localStorage to reset tab persistence between tests
    localStorage.clear();
    vi.mocked(isTMDBAvailable).mockResolvedValue(true);
    vi.mocked(searchMediaAction).mockResolvedValue({
      success: true,
      data: [],
    });
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
      data: { posters: [], backdrops: [] },
    });
    vi.mocked(getEpisodePreviewAction).mockResolvedValue({
      success: true,
      data: {
        name: "Episode 1 - Pilot",
        description: "The first episode of the series.",
        stillUrl: null,
        stillPath: null,
        seasonNumber: 1,
        episodeNumber: 1,
      },
    });
  });

  /** Helper to complete wizard: Next (step 1) → Next (step 2) → Apply (step 3) → Summary (step 4) */
  const completeWizard = async (user: ReturnType<typeof userEvent.setup>) => {
    await waitFor(() => {
      expect(screen.getByText("Apply Metadata")).toBeInTheDocument();
      expect(screen.getByText(/Step 1 of 4/i)).toBeInTheDocument();
    });

    await user.click(screen.getByRole("button", { name: /next/i }));

    await waitFor(() => {
      expect(screen.getByText(/Step 2 of 4/i)).toBeInTheDocument();
      expect(screen.queryByText(/Step 1 of 4/i)).not.toBeInTheDocument();
    });

    await user.click(screen.getByRole("button", { name: /next/i }));

    await waitFor(() => {
      expect(screen.getByText(/Step 3 of 4/i)).toBeInTheDocument();
      expect(screen.queryByText(/Step 2 of 4/i)).not.toBeInTheDocument();
    });

    await user.click(screen.getByRole("button", { name: /apply/i }));

    await waitFor(() => {
      expect(screen.getByText(/Step 4 of 4/i)).toBeInTheDocument();
      expect(screen.queryByText(/Step 3 of 4/i)).not.toBeInTheDocument();
    });
  };

  it("shows tabbed interface initially with Details and Files tabs", async () => {
    const user = userEvent.setup();

    render(
      <AddItemDialog
        open={true}
        onOpenChange={() => {}}
        onAdd={async () => undefined}
        hasDriveConnection={true}
      />
    );

    await waitFor(() => {
      expect(screen.getByRole("combobox")).toBeInTheDocument();
    });

    // Should have tabs initially
    expect(screen.getByRole("tab", { name: /details/i })).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: /files/i })).toBeInTheDocument();

    // Click Files tab to see file upload options
    await user.click(screen.getByRole("tab", { name: /files/i }));

    // Verify file upload sections are rendered
    expect(screen.getByText("Primary Media")).toBeInTheDocument();
    expect(screen.getByText("Primary Artwork")).toBeInTheDocument();
    expect(screen.getByText("Hero Image")).toBeInTheDocument();
    expect(screen.getByText("Default Subtitle")).toBeInTheDocument();
  });

  it("shows summary view with tabbed interface after wizard completion", async () => {
    const user = userEvent.setup();

    // Setup TMDB search result
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

    render(
      <AddItemDialog
        open={true}
        onOpenChange={() => {}}
        onAdd={async () => undefined}
        hasDriveConnection={true}
      />
    );

    await waitFor(() => {
      expect(screen.getByRole("combobox")).toBeInTheDocument();
    });

    // Search and select TMDB result to trigger wizard
    await user.type(screen.getByRole("combobox"), "Fight");
    await waitFor(() => {
      expect(screen.getByText("Fight Club")).toBeInTheDocument();
    });
    await user.click(screen.getByText("Fight Club"));

    // Complete the wizard
    await completeWizard(user);

    // After wizard, summary view should have tabs (Details and Files)
    expect(screen.getByRole("tab", { name: /details/i })).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: /files/i })).toBeInTheDocument();

    // Click Files tab to see file type sections
    await user.click(screen.getByRole("tab", { name: /files/i }));

    // Verify file type sections are rendered (using FileTypeCombobox labels)
    expect(screen.getByText("Primary Media")).toBeInTheDocument();
    expect(screen.getByText("Default Subtitle")).toBeInTheDocument();
  });

  it("creates item with no files when queues are empty", async () => {
    const user = userEvent.setup();
    const onAdd = vi.fn().mockResolvedValue(undefined);

    render(
      <AddItemDialog
        open={true}
        onOpenChange={() => {}}
        onAdd={onAdd}
        hasDriveConnection={true}
      />
    );

    await waitFor(() => {
      expect(screen.getByRole("combobox")).toBeInTheDocument();
    });

    await user.type(screen.getByRole("combobox"), "Test Item");
    await user.click(screen.getByRole("button", { name: /^create$/i }));

    await waitFor(() => {
      expect(onAdd).toHaveBeenCalledWith(
        "Test Item",
        undefined,
        undefined, // No files when queues are empty
        undefined
      );
    });
  });
});

describe("AddItemDialog - Summary View Layout", () => {
  // These tests verify the summary view layout appears ONLY after wizard completion

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(isTMDBAvailable).mockResolvedValue(true);
    vi.mocked(searchMediaAction).mockResolvedValue({
      success: true,
      data: [],
    });
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
    vi.mocked(getEpisodePreviewAction).mockResolvedValue({
      success: true,
      data: {
        name: "Episode 1 - Pilot",
        description: "The first episode of the series.",
        stillUrl: null,
        stillPath: null,
        seasonNumber: 1,
        episodeNumber: 1,
      },
    });
  });

  /** Helper to complete wizard: navigates to step 4 (wizard-summary) */
  const completeWizard = async (user: ReturnType<typeof userEvent.setup>) => {
    await waitFor(() => {
      expect(screen.getByText("Apply Metadata")).toBeInTheDocument();
      expect(screen.getByText(/Step 1 of 4/i)).toBeInTheDocument();
    });

    await user.click(screen.getByRole("button", { name: /next/i }));
    await waitFor(() => {
      expect(screen.getByText(/Step 2 of 4/i)).toBeInTheDocument();
    });

    await user.click(screen.getByRole("button", { name: /next/i }));
    await waitFor(() => {
      expect(screen.getByText(/Step 3 of 4/i)).toBeInTheDocument();
    });

    await user.click(screen.getByRole("button", { name: /apply/i }));
    await waitFor(() => {
      expect(screen.getByText(/Step 4 of 4/i)).toBeInTheDocument();
    });
  };

  it("should show tabbed interface initially (Details + Files tabs)", async () => {
    render(
      <AddItemDialog
        open={true}
        onOpenChange={() => {}}
        onAdd={async () => undefined}
        hasDriveConnection={true}
      />
    );

    // Wait for dialog to be ready
    await waitFor(() => {
      expect(screen.getByRole("dialog")).toBeInTheDocument();
    });

    // Should have tabs initially
    expect(screen.getByRole("tab", { name: /details/i })).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: /files/i })).toBeInTheDocument();

    // Name and description should be visible in Details tab
    expect(screen.getByLabelText(/name/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/description/i)).toBeInTheDocument();

    // Artwork preview cards should NOT be visible (only in summary view after wizard)
    expect(screen.queryByText("Artwork")).not.toBeInTheDocument();
    expect(screen.queryByText("Poster")).not.toBeInTheDocument();
    expect(screen.queryByText("Hero")).not.toBeInTheDocument();
  });

  it("should render summary view with all sections after wizard completion", async () => {
    const user = userEvent.setup();

    vi.mocked(searchMediaAction).mockResolvedValue({
      success: true,
      data: [
        {
          id: 550,
          mediaType: "movie",
          title: "Test Movie",
          overview: "Test overview",
          posterPath: "/poster.jpg",
          backdropPath: "/backdrop.jpg",
          year: "2023",
        },
      ],
    });

    render(
      <AddItemDialog
        open={true}
        onOpenChange={() => {}}
        onAdd={async () => undefined}
        hasDriveConnection={true}
      />
    );

    await waitFor(() => {
      expect(screen.getByRole("combobox")).toBeInTheDocument();
    });

    // Search and select TMDB result
    await user.type(screen.getByRole("combobox"), "Test");
    await waitFor(() => {
      expect(screen.getByText("Test Movie")).toBeInTheDocument();
    });
    await user.click(screen.getByText("Test Movie"));

    // Complete the wizard
    await completeWizard(user);

    // NOW all sections should be visible
    expect(screen.getByLabelText(/name/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/description/i)).toBeInTheDocument();
    expect(screen.getByText("Artwork")).toBeInTheDocument();
    expect(screen.getByText("Files")).toBeInTheDocument();
  });

  it("should show artwork preview cards for poster and hero after wizard completion", async () => {
    const user = userEvent.setup();

    vi.mocked(searchMediaAction).mockResolvedValue({
      success: true,
      data: [
        {
          id: 550,
          mediaType: "movie",
          title: "Test Movie",
          overview: "Test overview",
          posterPath: "/poster.jpg",
          backdropPath: "/backdrop.jpg",
          year: "2023",
        },
      ],
    });

    render(
      <AddItemDialog
        open={true}
        onOpenChange={() => {}}
        onAdd={async () => undefined}
        hasDriveConnection={true}
      />
    );

    await waitFor(() => {
      expect(screen.getByRole("combobox")).toBeInTheDocument();
    });

    // Search and select TMDB result
    await user.type(screen.getByRole("combobox"), "Test");
    await waitFor(() => {
      expect(screen.getByText("Test Movie")).toBeInTheDocument();
    });
    await user.click(screen.getByText("Test Movie"));

    // Complete the wizard
    await completeWizard(user);

    // Artwork section should have poster and hero thumbnails
    expect(screen.getByText("Poster")).toBeInTheDocument();
    expect(screen.getByText("Hero")).toBeInTheDocument();

    // Should show artwork images with amber selection styling (checkmarks visible)
    const posterPreview = screen.getByRole("button", {
      name: /poster preview/i,
    });
    const heroPreview = screen.getByRole("button", { name: /hero preview/i });
    expect(posterPreview).toBeInTheDocument();
    expect(heroPreview).toBeInTheDocument();
  });
});

describe("AddItemDialog slot-based layout", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(isTMDBAvailable).mockResolvedValue(true);
    vi.mocked(searchMediaAction).mockResolvedValue({
      success: true,
      data: [],
    });
  });

  it("passes header prop to AnimatedDialogContent", async () => {
    render(
      <AddItemDialog
        open
        onOpenChange={() => {}}
        onAdd={async () => undefined}
      />
    );

    // Header should contain the dialog title
    const header = await screen.findByRole("heading", { name: /create item/i });
    expect(header).toBeInTheDocument();

    // Header wrapper should have shrink-0
    const headerWrapper = header.closest("[data-slot='dialog-header-wrapper']");
    expect(headerWrapper).toBeInTheDocument();
  });

  it("passes footer prop to AnimatedDialogContent", async () => {
    render(
      <AddItemDialog
        open
        onOpenChange={() => {}}
        onAdd={async () => undefined}
      />
    );

    // Footer should contain action buttons
    const createButton = await screen.findByRole("button", { name: /create/i });
    expect(createButton).toBeInTheDocument();

    // Footer wrapper should have shrink-0
    const footerWrapper = createButton.closest(
      "[data-slot='dialog-footer-wrapper']"
    );
    expect(footerWrapper).toBeInTheDocument();
  });
});
