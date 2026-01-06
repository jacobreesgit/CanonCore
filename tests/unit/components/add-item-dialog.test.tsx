/**
 * Unit tests for AddItemDialog component.
 * Tests dialog rendering, form validation, and submission behavior.
 */

import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, vi } from "vitest";
import { AddItemDialog } from "@/components/items/add-item-dialog";

describe("AddItemDialog", () => {
  it("renders dialog when open", () => {
    render(
      <AddItemDialog
        open={true}
        onOpenChange={() => {}}
        onAdd={async () => undefined}
      />
    );

    expect(screen.getByRole("dialog")).toBeInTheDocument();
    expect(screen.getByText("Create Item")).toBeInTheDocument();
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

  it("focuses input on open", async () => {
    render(
      <AddItemDialog
        open={true}
        onOpenChange={() => {}}
        onAdd={async () => undefined}
      />
    );

    const input = screen.getByPlaceholderText(/item name/i);
    await waitFor(() => {
      expect(input).toHaveFocus();
    });
  });

  it("disables create button when input is empty", () => {
    render(
      <AddItemDialog
        open={true}
        onOpenChange={() => {}}
        onAdd={async () => undefined}
      />
    );

    const button = screen.getByRole("button", { name: /^create$/i });
    expect(button).toBeDisabled();
  });

  it("calls onAdd with trimmed item name on submit", async () => {
    const user = userEvent.setup();
    const onAdd = vi.fn().mockResolvedValue(undefined);

    render(<AddItemDialog open={true} onOpenChange={() => {}} onAdd={onAdd} />);

    await user.type(screen.getByPlaceholderText(/item name/i), "  New Item  ");
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

    await user.type(screen.getByPlaceholderText(/item name/i), "New Item");
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

    await user.type(screen.getByPlaceholderText(/item name/i), "New Item");
    await user.click(screen.getByRole("button", { name: /^create$/i }));

    await waitFor(() => {
      expect(onAdd).toHaveBeenCalled();
    });
    expect(onOpenChange).not.toHaveBeenCalledWith(false);
  });

  it("submits on Enter key", async () => {
    const user = userEvent.setup();
    const onAdd = vi.fn().mockResolvedValue(undefined);

    render(<AddItemDialog open={true} onOpenChange={() => {}} onAdd={onAdd} />);

    await user.type(
      screen.getByPlaceholderText(/item name/i),
      "New Item{enter}"
    );

    await waitFor(() => {
      expect(onAdd).toHaveBeenCalledWith("New Item", undefined);
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

    expect(screen.getByPlaceholderText(/item name/i)).toHaveValue("");
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

    await user.type(screen.getByPlaceholderText(/item name/i), "New Item");
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

    await user.type(screen.getByPlaceholderText(/item name/i), "   ");

    expect(screen.getByRole("button", { name: /^create$/i })).toBeDisabled();
  });

  it("shows parent item context in description", () => {
    render(
      <AddItemDialog
        open={true}
        onOpenChange={() => {}}
        onAdd={async () => undefined}
        parentName="Movies"
      />
    );

    expect(
      screen.getByText(/create a new item inside "Movies"/i)
    ).toBeInTheDocument();
  });

  it("renders description field", () => {
    render(
      <AddItemDialog
        open={true}
        onOpenChange={() => {}}
        onAdd={async () => undefined}
      />
    );

    expect(screen.getByLabelText(/description/i)).toBeInTheDocument();
    expect(screen.getByText("0/200 characters")).toBeInTheDocument();
  });

  it("passes description to onAdd when provided", async () => {
    const user = userEvent.setup();
    const onAdd = vi.fn().mockResolvedValue(undefined);

    render(<AddItemDialog open={true} onOpenChange={() => {}} onAdd={onAdd} />);

    await user.type(screen.getByPlaceholderText(/item name/i), "New Item");
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

    await user.type(screen.getByPlaceholderText(/item name/i), "New Item");
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

    await user.type(
      screen.getByPlaceholderText(/add a short description/i),
      "Hello"
    );

    expect(screen.getByText("5/200 characters")).toBeInTheDocument();
  });
});
