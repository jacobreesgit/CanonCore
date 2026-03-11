import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { SearchInput } from "@/components/ui/search-input";

describe("SearchInput", () => {
  it("renders with placeholder using Unicode ellipsis", () => {
    render(<SearchInput value="" onChange={vi.fn()} />);
    expect(screen.getByPlaceholderText("Search…")).toBeDefined();
  });

  it("has aria-label for accessibility", () => {
    render(<SearchInput value="" onChange={vi.fn()} />);
    expect(screen.getByLabelText("Search")).toBeDefined();
  });

  it("has autoComplete off", () => {
    render(<SearchInput value="" onChange={vi.fn()} />);
    const input = screen.getByRole("searchbox");
    expect(input.getAttribute("autocomplete")).toBe("off");
  });

  it("has spellCheck disabled", () => {
    render(<SearchInput value="" onChange={vi.fn()} />);
    const input = screen.getByRole("searchbox");
    expect(input.getAttribute("spellcheck")).toBe("false");
  });

  it("calls onChange on input", () => {
    const onChange = vi.fn();
    render(<SearchInput value="" onChange={onChange} />);
    fireEvent.change(screen.getByRole("searchbox"), {
      target: { value: "test" },
    });
    expect(onChange).toHaveBeenCalledWith("test");
  });

  it("shows clear button when value is non-empty", () => {
    render(<SearchInput value="hello" onChange={vi.fn()} />);
    expect(screen.getByLabelText("Clear search")).toBeDefined();
  });

  it("hides clear button when value is empty", () => {
    render(<SearchInput value="" onChange={vi.fn()} />);
    expect(screen.queryByLabelText("Clear search")).toBeNull();
  });
});
