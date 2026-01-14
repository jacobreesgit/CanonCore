/**
 * Unit tests for empty state variants.
 */

import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, vi } from "vitest";
import { EmptyState } from "@/components/items/empty-state";

describe("EmptyState", () => {
  describe("first-time variant", () => {
    it("renders first-time empty state", () => {
      render(<EmptyState variant="first-time" onAction={() => {}} />);

      expect(screen.getByText("No items yet")).toBeInTheDocument();
      expect(screen.getByText(/create your first item/i)).toBeInTheDocument();
      expect(
        screen.getByRole("button", { name: /add item/i })
      ).toBeInTheDocument();
    });

    it("calls onAction when button is clicked", async () => {
      const onAction = vi.fn();
      const user = userEvent.setup();
      render(<EmptyState variant="first-time" onAction={onAction} />);

      await user.click(screen.getByRole("button", { name: /add item/i }));

      expect(onAction).toHaveBeenCalled();
    });
  });

  describe("no-children variant", () => {
    it("renders no-children empty state", () => {
      render(<EmptyState variant="no-children" onAction={() => {}} />);

      expect(screen.getByText("No child items")).toBeInTheDocument();
      expect(
        screen.getByRole("button", { name: /add child/i })
      ).toBeInTheDocument();
    });
  });

  describe("filter-empty variant", () => {
    it("renders filter-empty empty state", () => {
      render(<EmptyState variant="filter-empty" onAction={() => {}} />);

      expect(screen.getByText("No matching items")).toBeInTheDocument();
      expect(
        screen.getByText(/no items match your current filter/i)
      ).toBeInTheDocument();
      expect(
        screen.getByRole("button", { name: /clear filter/i })
      ).toBeInTheDocument();
    });

    it("calls onAction to clear filter", async () => {
      const onAction = vi.fn();
      const user = userEvent.setup();
      render(<EmptyState variant="filter-empty" onAction={onAction} />);

      await user.click(screen.getByRole("button", { name: /clear filter/i }));

      expect(onAction).toHaveBeenCalled();
    });
  });

  describe("search-empty variant", () => {
    it("renders search-empty empty state", () => {
      render(<EmptyState variant="search-empty" onAction={() => {}} />);

      expect(screen.getByText("No results")).toBeInTheDocument();
      expect(
        screen.getByRole("button", { name: /clear search/i })
      ).toBeInTheDocument();
    });
  });

  it("renders without action button when onAction is not provided", () => {
    render(<EmptyState variant="first-time" />);

    expect(screen.getByText("No items yet")).toBeInTheDocument();
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
  });
});
