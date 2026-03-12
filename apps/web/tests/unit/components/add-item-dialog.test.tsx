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

  /**
   * Helper to complete wizard.
   * With hasDriveConnection=true: 5 steps (text → poster → hero → logo → review/apply)
   * With hasDriveConnection=false: 2 steps (text → review/apply)
   */
  // Note: AnimatedDialogContent uses AnimatePresence mode="sync" for crossfade,
  // so we must wait for old step to fully exit before querying Next button
  const completeWizard = async (
    user: ReturnType<typeof userEvent.setup>,
    hasDriveConnection = true
  ) => {
    if (hasDriveConnection) {
      // Wait for wizard step 1 (Title & Description) to appear
      await waitFor(() => {
        expect(screen.getByText("Apply Metadata")).toBeInTheDocument();
        expect(
          screen.getByRole("heading", { name: /title & description/i })
        ).toBeInTheDocument();
      });

      // Step 1 → Step 2
      await user.click(screen.getByRole("button", { name: /next/i }));

      // Wait for step 2 (Poster) AND ensure step 1 heading is gone
      await waitFor(() => {
        expect(
          screen.getByRole("heading", { name: /select poster/i })
        ).toBeInTheDocument();
        expect(
          screen.queryByRole("heading", { name: /title & description/i })
        ).not.toBeInTheDocument();
      });

      // Step 2 → Step 3
      await user.click(screen.getByRole("button", { name: /next/i }));

      // Wait for step 3 (Hero) AND ensure step 2 heading is gone
      await waitFor(() => {
        expect(
          screen.getByRole("heading", { name: /select hero image/i })
        ).toBeInTheDocument();
        expect(
          screen.queryByRole("heading", { name: /select poster/i })
        ).not.toBeInTheDocument();
      });

      // Step 3 → Step 4 (Logo)
      await user.click(screen.getByRole("button", { name: /next/i }));

      // Wait for step 4 (Logo) AND ensure step 3 heading is gone
      await waitFor(() => {
        expect(
          screen.getByRole("heading", { name: /select logo/i })
        ).toBeInTheDocument();
        expect(
          screen.queryByRole("heading", { name: /select hero image/i })
        ).not.toBeInTheDocument();
      });

      // Step 4 → Step 5 (Review Changes)
      await user.click(screen.getByRole("button", { name: /next/i }));

      // Wait for step 5 (Review Changes) AND ensure step 4 heading is gone
      await waitFor(() => {
        expect(
          screen.getByRole("heading", { name: /review changes/i })
        ).toBeInTheDocument();
        expect(
          screen.queryByRole("heading", { name: /select logo/i })
        ).not.toBeInTheDocument();
      });

      // Click Apply to complete wizard and go to final form
      await user.click(screen.getByRole("button", { name: /apply/i }));

      // Wait for final form (wizard-summary) - it shows "Review & Create" in the header
      await waitFor(() => {
        expect(
          screen.getByRole("heading", { name: /review & create/i })
        ).toBeInTheDocument();
      });
    } else {
      // Without Drive: 2 steps (text → review/apply)
      await waitFor(() => {
        expect(screen.getByText("Apply Metadata")).toBeInTheDocument();
        expect(
          screen.getByRole("heading", { name: /title & description/i })
        ).toBeInTheDocument();
      });

      // Step 1 → Step 2 (Review)
      await user.click(screen.getByRole("button", { name: /next/i }));

      // Wait for step 2 (Review Changes)
      await waitFor(() => {
        expect(
          screen.getByRole("heading", { name: /review changes/i })
        ).toBeInTheDocument();
      });

      // Click Apply to complete wizard and go to final form
      await user.click(screen.getByRole("button", { name: /apply/i }));

      // Wait for final form
      await waitFor(() => {
        expect(
          screen.getByRole("heading", { name: /review & create/i })
        ).toBeInTheDocument();
      });
    }
  };

  it("renders dialog when open", async () => {
    render(
      <AddItemDialog
        open={true}
        onOpenChange={() => {}}
        onAdd={async () => ({ itemId: "test-id" })}
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
        onAdd={async () => ({ itemId: "test-id" })}
      />
    );

    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("renders search combobox on open", async () => {
    render(
      <AddItemDialog
        open={true}
        onOpenChange={() => {}}
        onAdd={async () => ({ itemId: "test-id" })}
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
        onAdd={async () => ({ itemId: "test-id" })}
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
    const onAdd = vi.fn().mockResolvedValue({ itemId: "test-id" });

    render(<AddItemDialog open={true} onOpenChange={() => {}} onAdd={onAdd} />);

    await waitFor(() => {
      expect(screen.getByRole("combobox")).toBeInTheDocument();
    });

    await user.type(screen.getByRole("combobox"), "  New Item  ");
    await user.click(screen.getByRole("button", { name: /^create$/i }));

    await waitFor(() => {
      // onAdd now takes (name, description, tmdbSelection) - 3 args, not 4
      expect(onAdd).toHaveBeenCalledWith("New Item", undefined, undefined, {
        isPublic: false,
        inheritVisibility: false,
      });
    });
  });

  it("closes dialog on successful creation", async () => {
    const user = userEvent.setup();
    const onAdd = vi.fn().mockResolvedValue({ itemId: "test-id" });
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
    const onAdd = vi.fn().mockResolvedValue({ error: "Error message" });
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
    const onAdd = vi.fn().mockResolvedValue({ itemId: "test-id" });

    render(<AddItemDialog open={true} onOpenChange={() => {}} onAdd={onAdd} />);

    await waitFor(() => {
      expect(screen.getByRole("combobox")).toBeInTheDocument();
    });

    await user.type(screen.getByRole("combobox"), "Custom Item Name");
    await user.click(screen.getByRole("button", { name: /^create$/i }));

    await waitFor(() => {
      // onAdd now takes (name, description, tmdbSelection) - 3 args, not 4
      expect(onAdd).toHaveBeenCalledWith(
        "Custom Item Name",
        undefined,
        undefined,
        { isPublic: false, inheritVisibility: false }
      );
    });
  });

  it("clears input when dialog reopens", async () => {
    const { rerender } = render(
      <AddItemDialog
        open={false}
        onOpenChange={() => {}}
        onAdd={async () => ({ itemId: "test-id" })}
      />
    );

    rerender(
      <AddItemDialog
        open={true}
        onOpenChange={() => {}}
        onAdd={async () => ({ itemId: "test-id" })}
      />
    );

    await waitFor(() => {
      expect(screen.getByRole("combobox")).toBeInTheDocument();
    });

    expect(screen.getByRole("combobox")).toHaveValue("");
  });

  it("shows loading state during submission", async () => {
    const user = userEvent.setup();
    let resolveAdd: (value: { itemId?: string; error?: string }) => void;
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
      resolveAdd!({ itemId: "test-id" });
    });
  });

  it("closes dialog when Cancel button is clicked", async () => {
    const user = userEvent.setup();
    const onOpenChange = vi.fn();

    render(
      <AddItemDialog
        open={true}
        onOpenChange={onOpenChange}
        onAdd={async () => ({ itemId: "test-id" })}
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
        onAdd={async () => ({ itemId: "test-id" })}
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
        onAdd={async () => ({ itemId: "test-id" })}
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
        onAdd={async () => ({ itemId: "test-id" })}
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
    const onAdd = vi.fn().mockResolvedValue({ itemId: "test-id" });

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
      // onAdd now takes (name, description, tmdbSelection) - 3 args, not 4
      expect(onAdd).toHaveBeenCalledWith(
        "New Item",
        "My item description",
        undefined,
        { isPublic: false, inheritVisibility: false }
      );
    });
  });

  it("trims description whitespace", async () => {
    const user = userEvent.setup();
    const onAdd = vi.fn().mockResolvedValue({ itemId: "test-id" });

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
      // onAdd now takes (name, description, tmdbSelection) - 3 args, not 4
      expect(onAdd).toHaveBeenCalledWith(
        "New Item",
        "Trimmed description",
        undefined,
        { isPublic: false, inheritVisibility: false }
      );
    });
  });

  it("shows character count for description", async () => {
    const user = userEvent.setup();

    render(
      <AddItemDialog
        open={true}
        onOpenChange={() => {}}
        onAdd={async () => ({ itemId: "test-id" })}
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
        onAdd={async () => ({ itemId: "test-id" })}
        hasDriveConnection={true}
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

    // Complete the 4-step wizard
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
    const onAdd = vi.fn().mockResolvedValue({ itemId: "test-id" });
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

    await user.type(screen.getByRole("combobox"), "Shawshank");

    await waitFor(() => {
      expect(screen.getByText("The Shawshank Redemption")).toBeInTheDocument();
    });

    await user.click(screen.getByText("The Shawshank Redemption"));

    // Complete the 4-step wizard
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
        expect.objectContaining({
          tmdbId: 278,
          mediaType: "movie",
        }),
        { isPublic: false, inheritVisibility: false }
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
        onAdd={async () => ({ itemId: "test-id" })}
        hasDriveConnection={true}
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

    // Complete the 4-step wizard
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
        onAdd={async () => ({ itemId: "test-id" })}
      />
    );

    await waitFor(() => {
      expect(
        screen.getByPlaceholderText(/enter name manually/i)
      ).toBeInTheDocument();
    });
  });

  describe("visibility controls", () => {
    it("renders public toggle for root items", async () => {
      render(
        <AddItemDialog
          open={true}
          onOpenChange={vi.fn()}
          onAdd={vi.fn().mockResolvedValue({ itemId: "test-id" })}
        />
      );

      await waitFor(() => {
        expect(screen.getByRole("combobox")).toBeInTheDocument();
      });

      expect(screen.getByLabelText(/make public/i)).toBeInTheDocument();
    });

    it("does not render inherit toggle for root items", async () => {
      render(
        <AddItemDialog
          open={true}
          onOpenChange={vi.fn()}
          onAdd={vi.fn().mockResolvedValue({ itemId: "test-id" })}
        />
      );

      await waitFor(() => {
        expect(screen.getByRole("combobox")).toBeInTheDocument();
      });

      expect(screen.queryByLabelText(/inherit/i)).not.toBeInTheDocument();
    });

    it("renders inherit toggle when parentName provided", async () => {
      render(
        <AddItemDialog
          open={true}
          onOpenChange={vi.fn()}
          onAdd={vi.fn().mockResolvedValue({ itemId: "test-id" })}
          parentName="Marvel Series"
        />
      );

      await waitFor(() => {
        expect(screen.getByRole("combobox")).toBeInTheDocument();
      });

      expect(screen.getByLabelText(/inherit/i)).toBeInTheDocument();
    });

    it("disables public toggle when inherit is on", async () => {
      render(
        <AddItemDialog
          open={true}
          onOpenChange={vi.fn()}
          onAdd={vi.fn().mockResolvedValue({ itemId: "test-id" })}
          parentName="Marvel Series"
        />
      );

      await waitFor(() => {
        expect(screen.getByRole("combobox")).toBeInTheDocument();
      });

      // Inherit defaults to on for child items
      const publicToggle = screen.getByLabelText(/make public/i);
      expect(publicToggle).toBeDisabled();
    });

    it("passes visibility options to onAdd", async () => {
      const user = userEvent.setup();
      const onAdd = vi.fn().mockResolvedValue({ itemId: "new-1" });
      render(
        <AddItemDialog open={true} onOpenChange={vi.fn()} onAdd={onAdd} />
      );

      await waitFor(() => {
        expect(screen.getByRole("combobox")).toBeInTheDocument();
      });

      // Type a name
      const nameInput = screen.getByRole("combobox");
      await user.type(nameInput, "My Movie");

      // Close the combobox dropdown so the form is accessible
      await user.keyboard("{Escape}");

      // Toggle public on
      await user.click(screen.getByLabelText(/make public/i));

      // Submit
      await user.click(screen.getByRole("button", { name: /^create$/i }));

      await waitFor(() => {
        expect(onAdd).toHaveBeenCalledWith(
          "My Movie",
          undefined,
          undefined,
          expect.objectContaining({ isPublic: true, inheritVisibility: false })
        );
      });
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

  /** Helper to complete wizard: text → poster → hero → logo → review → apply */
  const completeWizard = async (user: ReturnType<typeof userEvent.setup>) => {
    await waitFor(() => {
      expect(screen.getByText("Apply Metadata")).toBeInTheDocument();
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

    await waitFor(() => {
      expect(
        screen.getByRole("heading", { name: /select logo/i })
      ).toBeInTheDocument();
    });

    await user.click(screen.getByRole("button", { name: /next/i }));

    await waitFor(() => {
      expect(
        screen.getByRole("heading", { name: /review changes/i })
      ).toBeInTheDocument();
    });

    await user.click(screen.getByRole("button", { name: /apply/i }));

    await waitFor(() => {
      expect(
        screen.getByRole("heading", { name: /review & create/i })
      ).toBeInTheDocument();
    });
  };

  it("shows tabbed interface initially with Details and Files tabs", async () => {
    const user = userEvent.setup();

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
        onAdd={async () => ({ itemId: "test-id" })}
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

    // After wizard completes, summary view should show tabs
    // Use getAllByRole and verify we have at least the expected tabs
    await waitFor(() => {
      const detailsTabs = screen.getAllByRole("tab", { name: /details/i });
      const filesTabs = screen.getAllByRole("tab", { name: /files/i });
      expect(detailsTabs.length).toBeGreaterThan(0);
      expect(filesTabs.length).toBeGreaterThan(0);
    });

    // Click the Files tab (get all and click the last one, which should be the summary view tab)
    const filesTabs = screen.getAllByRole("tab", { name: /files/i });
    await user.click(filesTabs[filesTabs.length - 1]);

    // Verify file type sections are rendered (using FileTypeCombobox labels)
    expect(screen.getByText("Primary Media")).toBeInTheDocument();
    expect(screen.getByText("Default Subtitle")).toBeInTheDocument();
  });

  it("creates item with no files when queues are empty", async () => {
    const user = userEvent.setup();
    const onAdd = vi.fn().mockResolvedValue({ itemId: "test-id" });

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
      // onAdd now takes (name, description, tmdbSelection) - 3 args, not 4
      expect(onAdd).toHaveBeenCalledWith("Test Item", undefined, undefined, {
        isPublic: false,
        inheritVisibility: false,
      });
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

  /** Helper to complete wizard: text → poster → hero → logo → review → apply */
  const completeWizard = async (user: ReturnType<typeof userEvent.setup>) => {
    await waitFor(() => {
      expect(screen.getByText("Apply Metadata")).toBeInTheDocument();
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
    await waitFor(() => {
      expect(
        screen.getByRole("heading", { name: /select logo/i })
      ).toBeInTheDocument();
    });

    await user.click(screen.getByRole("button", { name: /next/i }));
    await waitFor(() => {
      expect(
        screen.getByRole("heading", { name: /review changes/i })
      ).toBeInTheDocument();
    });

    await user.click(screen.getByRole("button", { name: /apply/i }));
    await waitFor(() => {
      expect(
        screen.getByRole("heading", { name: /review & create/i })
      ).toBeInTheDocument();
    });
  };

  it("should show tabbed interface initially (Details + Files tabs)", async () => {
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
        onAdd={async () => ({ itemId: "test-id" })}
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

    // NOW all sections should be visible in summary view
    await waitFor(() => {
      expect(screen.getByLabelText(/name/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/description/i)).toBeInTheDocument();
    });

    // Artwork section uses individual "Poster" and "Hero Banner" labels
    // Use getAllByText since "Poster" appears in wizard step indicator too
    const posterLabels = screen.getAllByText("Poster");
    expect(posterLabels.length).toBeGreaterThan(0);
    expect(screen.getByText("Hero Banner")).toBeInTheDocument();

    // Files tab exists (there may be multiple, so use getAllByRole)
    const filesTabs = screen.getAllByRole("tab", { name: /files/i });
    expect(filesTabs.length).toBeGreaterThan(0);
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
        onAdd={async () => ({ itemId: "test-id" })}
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
    // Use getAllByText since "Poster" appears in wizard step indicator too
    const posterLabels = screen.getAllByText("Poster");
    expect(posterLabels.length).toBeGreaterThan(0);
    const heroLabels = screen.getAllByText("Hero Banner");
    expect(heroLabels.length).toBeGreaterThan(0);

    // Should show artwork images in dropzone-style buttons
    const posterPreview = screen.getByRole("img", {
      name: /poster preview/i,
    });
    const heroPreview = screen.getByRole("img", {
      name: /hero banner preview/i,
    });
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
        onAdd={async () => ({ itemId: "test-id" })}
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
        onAdd={async () => ({ itemId: "test-id" })}
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
