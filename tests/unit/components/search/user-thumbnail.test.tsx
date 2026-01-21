/**
 * Unit tests for UserThumbnail component.
 */

import { render, screen } from "@testing-library/react";
import { describe, it, expect } from "vitest";
import { UserThumbnail } from "@/components/search/user-thumbnail";

describe("UserThumbnail", () => {
  it("shows initials when name is provided", () => {
    render(<UserThumbnail userId="user-123" name="John Doe" />);

    expect(screen.getByText("JD")).toBeInTheDocument();
  });

  it("shows first letter when name is single word", () => {
    render(<UserThumbnail userId="user-123" name="Alice" />);

    expect(screen.getByText("A")).toBeInTheDocument();
  });

  it("shows user icon when name is null", () => {
    render(<UserThumbnail userId="user-123" name={null} />);

    expect(document.querySelector('[aria-hidden="true"]')).toBeInTheDocument();
  });

  it("handles empty string name gracefully", () => {
    render(<UserThumbnail userId="user-123" name="" />);

    // Should show icon fallback for empty string
    expect(document.querySelector('[aria-hidden="true"]')).toBeInTheDocument();
  });

  it("handles multi-word names correctly", () => {
    render(<UserThumbnail userId="user-123" name="John Paul Smith" />);

    // Should take first letter of first two words
    expect(screen.getByText("JP")).toBeInTheDocument();
  });

  it("uppercases initials", () => {
    render(<UserThumbnail userId="user-123" name="john doe" />);

    expect(screen.getByText("JD")).toBeInTheDocument();
  });

  it("trims whitespace from name", () => {
    render(<UserThumbnail userId="user-123" name="  Jane Doe  " />);

    expect(screen.getByText("JD")).toBeInTheDocument();
  });
});
