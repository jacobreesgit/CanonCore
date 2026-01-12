/**
 * Unit tests for MediaSearchCombobox component.
 */

import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { MediaSearchCombobox } from "@/components/items/media-search-combobox";

// Mock server actions
vi.mock("@/lib/tmdb-actions", () => ({
  searchMediaAction: vi.fn(),
  isTMDBAvailable: vi.fn(),
}));

import { searchMediaAction, isTMDBAvailable } from "@/lib/tmdb-actions";

describe("MediaSearchCombobox", () => {
  const mockOnSelect = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(isTMDBAvailable).mockResolvedValue(true);
    vi.mocked(searchMediaAction).mockResolvedValue({
      success: true,
      data: [],
    });
  });

  it("renders input field", async () => {
    render(<MediaSearchCombobox onSelect={mockOnSelect} />);

    // Wait for TMDB check and combobox to appear
    await waitFor(() => {
      expect(screen.getByRole("combobox")).toBeInTheDocument();
    });
  });

  it("renders with custom placeholder", async () => {
    render(
      <MediaSearchCombobox
        onSelect={mockOnSelect}
        placeholder="Find a movie..."
      />
    );

    await waitFor(() => {
      expect(
        screen.getByPlaceholderText("Find a movie...")
      ).toBeInTheDocument();
    });
  });

  it("shows loading state during search", async () => {
    const user = userEvent.setup();
    // Create a promise that never resolves to keep loading state visible
    vi.mocked(searchMediaAction).mockImplementation(
      () => new Promise(() => {})
    );

    render(<MediaSearchCombobox onSelect={mockOnSelect} />);

    // Wait for TMDB check
    await waitFor(() => {
      expect(screen.getByRole("combobox")).toBeInTheDocument();
    });

    const input = screen.getByRole("combobox");
    await user.type(input, "Breaking");

    // Wait for debounce and loading state
    await waitFor(
      () => {
        expect(screen.getByText(/searching/i)).toBeInTheDocument();
      },
      { timeout: 500 }
    );
  });

  it("displays search results after debounce", async () => {
    const user = userEvent.setup();
    vi.mocked(searchMediaAction).mockResolvedValue({
      success: true,
      data: [
        {
          id: 1396,
          mediaType: "tv",
          title: "Breaking Bad",
          overview: "A chemistry teacher...",
          posterPath: "/poster.jpg",
          year: "2008",
        },
      ],
    });

    render(<MediaSearchCombobox onSelect={mockOnSelect} />);

    await waitFor(() => {
      expect(screen.getByRole("combobox")).toBeInTheDocument();
    });

    const input = screen.getByRole("combobox");
    await user.type(input, "Breaking Bad");

    await waitFor(
      () => {
        expect(screen.getByText("Breaking Bad")).toBeInTheDocument();
        expect(screen.getByText("2008")).toBeInTheDocument();
        expect(screen.getByText("TV")).toBeInTheDocument();
      },
      { timeout: 500 }
    );
  });

  it("calls onSelect when result clicked", async () => {
    const user = userEvent.setup();
    vi.mocked(searchMediaAction).mockResolvedValue({
      success: true,
      data: [
        {
          id: 1396,
          mediaType: "tv",
          title: "Breaking Bad",
          overview: "A chemistry teacher turns to crime.",
          posterPath: "/poster.jpg",
          year: "2008",
        },
      ],
    });

    render(<MediaSearchCombobox onSelect={mockOnSelect} />);

    await waitFor(() => {
      expect(screen.getByRole("combobox")).toBeInTheDocument();
    });

    const input = screen.getByRole("combobox");
    await user.type(input, "Breaking");

    await waitFor(() => {
      expect(screen.getByText("Breaking Bad")).toBeInTheDocument();
    });

    await user.click(screen.getByText("Breaking Bad"));

    expect(mockOnSelect).toHaveBeenCalledWith({
      id: 1396,
      mediaType: "tv",
      title: "Breaking Bad",
      overview: "A chemistry teacher turns to crime.",
      posterPath: "/poster.jpg",
      year: "2008",
    });
  });

  it("debounces search requests (300ms)", async () => {
    const user = userEvent.setup();

    render(<MediaSearchCombobox onSelect={mockOnSelect} />);

    await waitFor(() => {
      expect(screen.getByRole("combobox")).toBeInTheDocument();
    });

    const input = screen.getByRole("combobox");

    // Type quickly (no delay - default is fast enough to test debounce)
    await user.type(input, "test");

    // Should not have called yet (debounce not finished)
    expect(searchMediaAction).not.toHaveBeenCalled();

    // Wait for debounce
    await waitFor(
      () => {
        expect(searchMediaAction).toHaveBeenCalledTimes(1);
        expect(searchMediaAction).toHaveBeenCalledWith("test");
      },
      { timeout: 500 }
    );
  });

  it("shows fallback input when TMDB not configured", async () => {
    vi.mocked(isTMDBAvailable).mockResolvedValue(false);

    render(<MediaSearchCombobox onSelect={mockOnSelect} />);

    await waitFor(() => {
      expect(
        screen.getByPlaceholderText(/enter name manually/i)
      ).toBeInTheDocument();
    });
  });

  it("shows poster thumbnail in results", async () => {
    const user = userEvent.setup();
    vi.mocked(searchMediaAction).mockResolvedValue({
      success: true,
      data: [
        {
          id: 1,
          mediaType: "movie",
          title: "Test Movie",
          overview: "Description",
          posterPath: "/poster.jpg",
          year: "2023",
        },
      ],
    });

    render(<MediaSearchCombobox onSelect={mockOnSelect} />);

    await waitFor(() => {
      expect(screen.getByRole("combobox")).toBeInTheDocument();
    });

    const input = screen.getByRole("combobox");
    await user.type(input, "Test");

    await waitFor(() => {
      // Image has alt="" making it presentational, so we find by tag
      const img = document.querySelector("img");
      expect(img).toBeInTheDocument();
      expect(img).toHaveAttribute("src", expect.stringContaining("tmdb.org"));
    });
  });

  it("shows movie badge for movies", async () => {
    const user = userEvent.setup();
    vi.mocked(searchMediaAction).mockResolvedValue({
      success: true,
      data: [
        {
          id: 1,
          mediaType: "movie",
          title: "Test Movie",
          overview: "Description",
          posterPath: null,
          year: "2023",
        },
      ],
    });

    render(<MediaSearchCombobox onSelect={mockOnSelect} />);

    await waitFor(() => {
      expect(screen.getByRole("combobox")).toBeInTheDocument();
    });

    const input = screen.getByRole("combobox");
    await user.type(input, "Test");

    await waitFor(() => {
      expect(screen.getByText("Movie")).toBeInTheDocument();
    });
  });

  it("shows no results message when search returns empty", async () => {
    const user = userEvent.setup();
    vi.mocked(searchMediaAction).mockResolvedValue({
      success: true,
      data: [],
    });

    render(<MediaSearchCombobox onSelect={mockOnSelect} />);

    await waitFor(() => {
      expect(screen.getByRole("combobox")).toBeInTheDocument();
    });

    const input = screen.getByRole("combobox");
    await user.type(input, "xyznonexistent");

    await waitFor(
      () => {
        expect(screen.getByText(/no results/i)).toBeInTheDocument();
      },
      { timeout: 500 }
    );
  });

  it("does not search for queries less than 2 characters", async () => {
    const user = userEvent.setup();

    render(<MediaSearchCombobox onSelect={mockOnSelect} />);

    await waitFor(() => {
      expect(screen.getByRole("combobox")).toBeInTheDocument();
    });

    const input = screen.getByRole("combobox");
    await user.type(input, "a");

    // Wait to ensure debounce would have fired
    await new Promise((r) => setTimeout(r, 400));

    expect(searchMediaAction).not.toHaveBeenCalled();
  });

  it("updates input value when typing", async () => {
    const user = userEvent.setup();

    render(<MediaSearchCombobox onSelect={mockOnSelect} />);

    await waitFor(() => {
      expect(screen.getByRole("combobox")).toBeInTheDocument();
    });

    const input = screen.getByRole("combobox");
    await user.type(input, "Matrix");

    expect(input).toHaveValue("Matrix");
  });

  it("closes popover after selection", async () => {
    const user = userEvent.setup();
    vi.mocked(searchMediaAction).mockResolvedValue({
      success: true,
      data: [
        {
          id: 1,
          mediaType: "movie",
          title: "The Matrix",
          overview: "A computer hacker...",
          posterPath: "/matrix.jpg",
          year: "1999",
        },
      ],
    });

    render(<MediaSearchCombobox onSelect={mockOnSelect} />);

    await waitFor(() => {
      expect(screen.getByRole("combobox")).toBeInTheDocument();
    });

    const input = screen.getByRole("combobox");
    await user.type(input, "Matrix");

    await waitFor(() => {
      expect(screen.getByText("The Matrix")).toBeInTheDocument();
    });

    await user.click(screen.getByText("The Matrix"));

    // Popover should close - results should not be visible
    await waitFor(() => {
      expect(screen.queryByText("1999")).not.toBeInTheDocument();
    });
  });

  it("handles search error gracefully", async () => {
    const user = userEvent.setup();
    vi.mocked(searchMediaAction).mockResolvedValue({
      success: false,
      error: "API error",
    });

    render(<MediaSearchCombobox onSelect={mockOnSelect} />);

    await waitFor(() => {
      expect(screen.getByRole("combobox")).toBeInTheDocument();
    });

    const input = screen.getByRole("combobox");
    await user.type(input, "Test");

    // Should show no results, not crash
    await waitFor(
      () => {
        expect(screen.getByText(/no results/i)).toBeInTheDocument();
      },
      { timeout: 500 }
    );
  });
});
