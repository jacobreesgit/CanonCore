/**
 * Unit tests for TmdbSourceField component.
 * Verifies DOM parity with FileTypeCombobox: header, trigger button,
 * thumbnail rendering, inline detach icon, and empty state.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { TmdbSourceField } from "@/components/items/tmdb-source-field";

vi.mock("@/lib/tmdb-actions", () => ({
  clearTmdbFieldAction: vi.fn().mockResolvedValue({ success: true }),
}));

vi.mock("@/lib/tmdb-client", () => ({
  getPosterUrl: (path: string | null, _size: string) =>
    path ? `https://image.tmdb.org/t/p/w92${path}` : null,
}));

describe("TmdbSourceField", () => {
  const linkedItem = {
    id: "item-123",
    tmdbId: 155,
    tmdbType: "movie" as const,
    tmdbPosterPath: "/poster.jpg",
    name: "The Dark Knight",
  };

  const unlinkedItem = {
    id: "item-456",
    tmdbId: null,
    tmdbType: null,
    tmdbPosterPath: null,
    name: "My Custom Item",
  };

  const defaultProps = {
    item: linkedItem,
    onChange: vi.fn(),
    onSettingsChange: vi.fn().mockResolvedValue(undefined),
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders header with label and description", () => {
    render(<TmdbSourceField {...defaultProps} />);

    expect(screen.getByText("TMDB Source")).toBeInTheDocument();
    expect(
      screen.getByText("The movie or TV show linked to this item.")
    ).toBeInTheDocument();
  });

  it("renders trigger with poster thumbnail and title when linked", () => {
    render(<TmdbSourceField {...defaultProps} />);

    const trigger = screen.getByRole("button", { name: /the dark knight/i });
    expect(trigger).toBeInTheDocument();
    expect(screen.getByRole("presentation")).toBeInTheDocument();
    expect(screen.getByText("Movie")).toBeInTheDocument();
  });

  it("renders trigger with placeholder when not linked", () => {
    render(<TmdbSourceField {...defaultProps} item={unlinkedItem} />);

    expect(screen.getByText("Search TMDB\u2026")).toBeInTheDocument();
    expect(screen.queryByRole("presentation")).not.toBeInTheDocument();
  });

  it("calls onChange when trigger is clicked", async () => {
    const user = userEvent.setup();
    render(<TmdbSourceField {...defaultProps} />);

    await user.click(screen.getByRole("button", { name: /the dark knight/i }));

    expect(defaultProps.onChange).toHaveBeenCalledOnce();
  });

  it("renders inline detach icon when linked", () => {
    render(<TmdbSourceField {...defaultProps} />);

    expect(
      screen.getByRole("button", { name: /detach tmdb/i })
    ).toBeInTheDocument();
  });

  it("hides detach icon when not linked", () => {
    render(<TmdbSourceField {...defaultProps} item={unlinkedItem} />);

    expect(
      screen.queryByRole("button", { name: /detach/i })
    ).not.toBeInTheDocument();
  });

  it("shows confirmation dialog when detach icon is clicked", async () => {
    const user = userEvent.setup();
    render(<TmdbSourceField {...defaultProps} />);

    await user.click(screen.getByRole("button", { name: /detach tmdb/i }));

    expect(screen.getByText(/are you sure/i)).toBeInTheDocument();
  });

  it("calls clearTmdbFieldAction on detach confirm", async () => {
    const { clearTmdbFieldAction } = await import("@/lib/tmdb-actions");
    const user = userEvent.setup();
    render(<TmdbSourceField {...defaultProps} />);

    await user.click(screen.getByRole("button", { name: /detach tmdb/i }));
    await user.click(screen.getByRole("button", { name: /confirm/i }));

    expect(clearTmdbFieldAction).toHaveBeenCalledWith("item-123", "all");
  });

  it("does not trigger onChange when detach icon is clicked", async () => {
    const user = userEvent.setup();
    render(<TmdbSourceField {...defaultProps} />);

    await user.click(screen.getByRole("button", { name: /detach tmdb/i }));

    expect(defaultProps.onChange).not.toHaveBeenCalled();
  });

  it("trigger is enabled by default when linked", () => {
    render(<TmdbSourceField {...defaultProps} />);

    expect(
      screen.getByRole("button", { name: /the dark knight/i })
    ).toBeEnabled();
  });

  it("opens detach dialog via keyboard Enter on detach icon", async () => {
    const user = userEvent.setup();
    render(<TmdbSourceField {...defaultProps} />);

    const detachIcon = screen.getByRole("button", { name: /detach tmdb/i });
    detachIcon.focus();
    await user.keyboard("{Enter}");

    expect(screen.getByText(/are you sure/i)).toBeInTheDocument();
  });

  it("opens detach dialog via keyboard Space on detach icon", async () => {
    const user = userEvent.setup();
    render(<TmdbSourceField {...defaultProps} />);

    const detachIcon = screen.getByRole("button", { name: /detach tmdb/i });
    detachIcon.focus();
    await user.keyboard(" ");

    expect(screen.getByText(/are you sure/i)).toBeInTheDocument();
  });
});
