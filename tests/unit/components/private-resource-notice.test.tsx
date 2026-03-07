import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { PrivateResourceNotice } from "@/components/ui/private-resource-notice";

describe("PrivateResourceNotice", () => {
  it("renders heading with resource type", () => {
    render(<PrivateResourceNotice resourceType="item" />);
    expect(
      screen.getByRole("heading", { level: 1, name: /this item is private/i })
    ).toBeDefined();
  });

  it("renders playlist resource type", () => {
    render(<PrivateResourceNotice resourceType="playlist" />);
    expect(
      screen.getByRole("heading", {
        level: 1,
        name: /this playlist is private/i,
      })
    ).toBeDefined();
  });

  it("shows settings link when settingsUrl is provided", () => {
    render(
      <PrivateResourceNotice
        resourceType="item"
        settingsUrl="/u/testuser/abc123?settings=true"
      />
    );
    const link = screen.getByRole("link", { name: /open settings/i });
    expect(link.getAttribute("href")).toBe("/u/testuser/abc123?settings=true");
  });

  it("hides settings link when settingsUrl is not provided", () => {
    render(<PrivateResourceNotice resourceType="item" />);
    expect(screen.queryByRole("link", { name: /open settings/i })).toBeNull();
  });

  it("always shows Go to Explore link", () => {
    render(<PrivateResourceNotice resourceType="item" />);
    const link = screen.getByRole("link", { name: /go to explore/i });
    expect(link.getAttribute("href")).toBe("/explore");
  });

  it("shows subtext about making it public", () => {
    render(<PrivateResourceNotice resourceType="item" />);
    expect(screen.getByText(/only you can see this/i)).toBeDefined();
  });
});
