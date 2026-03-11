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
          <DialogFooter>
            <button>Save</button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    );

    // Find footer via data-slot attribute (shadcn/ui convention).
    // Falls back to parentElement for compatibility if data-slot changes.
    const saveButton = screen.getByRole("button", { name: "Save" });
    const footer =
      saveButton.closest("[data-slot='dialog-footer']") ??
      saveButton.parentElement;
    expect(footer).not.toBeNull();
    expect(footer!.className).toContain("shrink-0");
  });

  it("renders with gap-2 for button spacing", () => {
    render(
      <Dialog open>
        <DialogContent>
          <DialogFooter>
            <button>Save</button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    );

    // Find footer via data-slot attribute (shadcn/ui convention).
    // Falls back to parentElement for compatibility if data-slot changes.
    const saveButton = screen.getByRole("button", { name: "Save" });
    const footer =
      saveButton.closest("[data-slot='dialog-footer']") ??
      saveButton.parentElement;
    expect(footer).not.toBeNull();
    expect(footer!.className).toContain("gap-2");
  });
});

describe("DialogContent", () => {
  it("uses flex-col layout", () => {
    render(
      <Dialog open>
        <DialogContent>Content</DialogContent>
      </Dialog>
    );

    const content = screen.getByRole("dialog");
    expect(content.className).toContain("flex");
    expect(content.className).toContain("flex-col");
  });
});
