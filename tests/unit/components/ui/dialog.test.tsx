/**
 * Unit tests for Dialog components.
 * Tests DialogFooter styling for sticky footer support.
 */

import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { Dialog, DialogContent, DialogFooter } from "@/components/ui/dialog";

describe("DialogFooter", () => {
  it("renders with shrink-0 to prevent compression", () => {
    render(
      <Dialog open>
        <DialogContent>
          <DialogFooter data-testid="footer">
            <button>Save</button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    );

    const footer = screen.getByTestId("footer");
    expect(footer.className).toContain("shrink-0");
  });

  it("renders with pt-4 for top padding", () => {
    render(
      <Dialog open>
        <DialogContent>
          <DialogFooter data-testid="footer">
            <button>Save</button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    );

    const footer = screen.getByTestId("footer");
    expect(footer.className).toContain("pt-4");
  });
});

describe("DialogContent", () => {
  it("uses flex-col layout", () => {
    render(
      <Dialog open>
        <DialogContent data-testid="content">Content</DialogContent>
      </Dialog>
    );

    const content = screen.getByTestId("content");
    expect(content.className).toContain("flex");
    expect(content.className).toContain("flex-col");
  });
});
