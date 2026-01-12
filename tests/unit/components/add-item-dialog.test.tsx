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
}));

import { searchMediaAction, isTMDBAvailable } from "@/lib/tmdb-actions";

describe("AddItemDialog", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(isTMDBAvailable).mockResolvedValue(true);
    vi.mocked(searchMediaAction).mockResolvedValue({
      success: true,
      data: [],
    });
  });

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
      expect(onAdd).toHaveBeenCalledWith("New Item", undefined);
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
      expect(onAdd).toHaveBeenCalledWith("Custom Item Name", undefined);
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
      expect(onAdd).toHaveBeenCalledWith("New Item", "My item description");
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
      expect(onAdd).toHaveBeenCalledWith("New Item", "Trimmed description");
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
    await user.type(input, "Breaking");

    await waitFor(() => {
      expect(screen.getByText("Breaking Bad")).toBeInTheDocument();
    });

    await user.click(screen.getByText("Breaking Bad"));

    // Verify form fields were auto-filled
    expect(input).toHaveValue("Breaking Bad (2008)");
    expect(screen.getByPlaceholderText(/add a short description/i)).toHaveValue(
      "A chemistry teacher turns to crime."
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
          year: "1994",
        },
      ],
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
    await user.click(screen.getByRole("button", { name: /^create$/i }));

    await waitFor(() => {
      expect(onAdd).toHaveBeenCalledWith(
        "The Shawshank Redemption (1994)",
        "Two imprisoned men bond over a number of years."
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
          year: "",
        },
      ],
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

    expect(screen.getByRole("combobox")).toHaveValue("Unknown Movie");
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
