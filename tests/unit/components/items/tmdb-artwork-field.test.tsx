/**
 * Unit tests for TmdbArtworkField component.
 * Verifies DOM parity with FileTypeCombobox: header, trigger button,
 * thumbnail rendering, inline clear icon, and note slot.
 */

import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { faImage } from "@fortawesome/free-solid-svg-icons";
import { TmdbArtworkField } from "@/components/items/tmdb-artwork-field";

describe("TmdbArtworkField", () => {
  const defaultProps = {
    label: "Poster",
    description: "The poster image from TMDB used as the thumbnail.",
    icon: faImage,
    imagePath: "/poster.jpg",
    imageUrl: "https://image.tmdb.org/t/p/w500/poster.jpg",
    onChange: vi.fn(),
    onClear: vi.fn(),
  };

  it("renders header with label and description", () => {
    render(<TmdbArtworkField {...defaultProps} />);

    expect(screen.getByText("Poster")).toBeInTheDocument();
    expect(
      screen.getByText("The poster image from TMDB used as the thumbnail.")
    ).toBeInTheDocument();
  });

  it("renders trigger button with thumbnail and path when image is set", () => {
    render(<TmdbArtworkField {...defaultProps} />);

    const trigger = screen.getByRole("button", { name: "/poster.jpg" });
    expect(trigger).toBeInTheDocument();
    expect(screen.getByText("/poster.jpg")).toBeInTheDocument();
    expect(screen.getByRole("presentation")).toBeInTheDocument();
  });

  it("renders trigger button with placeholder when no image is set", () => {
    render(
      <TmdbArtworkField {...defaultProps} imageUrl={null} imagePath={null} />
    );

    expect(screen.getByText("Change poster\u2026")).toBeInTheDocument();
    expect(screen.queryByRole("presentation")).not.toBeInTheDocument();
  });

  it("calls onChange when trigger button is clicked", async () => {
    const user = userEvent.setup();
    render(<TmdbArtworkField {...defaultProps} />);

    await user.click(screen.getByRole("button", { name: "/poster.jpg" }));

    expect(defaultProps.onChange).toHaveBeenCalledOnce();
  });

  it("renders inline clear icon when imagePath is set", () => {
    render(<TmdbArtworkField {...defaultProps} />);

    expect(
      screen.getByRole("button", { name: /clear poster/i })
    ).toBeInTheDocument();
  });

  it("calls onClear when clear icon is clicked without triggering onChange", async () => {
    const onChange = vi.fn();
    const onClear = vi.fn();
    const user = userEvent.setup();
    render(
      <TmdbArtworkField
        {...defaultProps}
        onChange={onChange}
        onClear={onClear}
      />
    );

    await user.click(screen.getByRole("button", { name: /clear poster/i }));

    expect(onClear).toHaveBeenCalledOnce();
    expect(onChange).not.toHaveBeenCalled();
  });

  it("hides clear icon when no imagePath", () => {
    render(
      <TmdbArtworkField {...defaultProps} imagePath={null} imageUrl={null} />
    );

    expect(
      screen.queryByRole("button", { name: /clear/i })
    ).not.toBeInTheDocument();
  });

  it("disables trigger when loading", () => {
    render(<TmdbArtworkField {...defaultProps} isLoading />);

    expect(screen.getByRole("button", { name: "/poster.jpg" })).toBeDisabled();
  });

  it("renders note content when provided", () => {
    render(
      <TmdbArtworkField
        {...defaultProps}
        note={<span data-testid="override-note">Overridden by upload</span>}
      />
    );

    expect(screen.getByTestId("override-note")).toBeInTheDocument();
    expect(screen.getByText("Overridden by upload")).toBeInTheDocument();
  });

  it("does not render note when not provided", () => {
    render(<TmdbArtworkField {...defaultProps} />);

    expect(screen.queryByTestId("override-note")).not.toBeInTheDocument();
  });
});
