/**
 * Unit tests for AlertDialog components.
 * Tests AlertDialogFooter styling for sticky footer support.
 */

import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogFooter,
  AlertDialogCancel,
} from "@/components/ui/alert-dialog";

describe("AlertDialogFooter", () => {
  it("renders with shrink-0 to prevent compression", () => {
    render(
      <AlertDialog open>
        <AlertDialogContent>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    );

    // Find footer via data-slot attribute (shadcn/ui convention).
    // Falls back to parentElement for compatibility if data-slot changes.
    const cancelButton = screen.getByRole("button", { name: "Cancel" });
    const footer =
      cancelButton.closest("[data-slot='alert-dialog-footer']") ??
      cancelButton.parentElement;
    expect(footer).not.toBeNull();
    expect(footer!.className).toContain("shrink-0");
  });

  it("renders with gap-2 for button spacing", () => {
    render(
      <AlertDialog open>
        <AlertDialogContent>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    );

    // Find footer via data-slot attribute (shadcn/ui convention).
    // Falls back to parentElement for compatibility if data-slot changes.
    const cancelButton = screen.getByRole("button", { name: "Cancel" });
    const footer =
      cancelButton.closest("[data-slot='alert-dialog-footer']") ??
      cancelButton.parentElement;
    expect(footer).not.toBeNull();
    expect(footer!.className).toContain("gap-2");
  });
});

describe("AlertDialogContent", () => {
  it("uses flex-col layout", () => {
    render(
      <AlertDialog open>
        <AlertDialogContent>Content</AlertDialogContent>
      </AlertDialog>
    );

    const content = screen.getByRole("alertdialog");
    expect(content.className).toContain("flex");
    expect(content.className).toContain("flex-col");
  });
});
