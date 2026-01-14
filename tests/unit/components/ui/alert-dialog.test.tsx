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
          <AlertDialogFooter data-testid="footer">
            <AlertDialogCancel>Cancel</AlertDialogCancel>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    );

    const footer = screen.getByTestId("footer");
    expect(footer.className).toContain("shrink-0");
  });

  it("renders with pt-4 for top padding", () => {
    render(
      <AlertDialog open>
        <AlertDialogContent>
          <AlertDialogFooter data-testid="footer">
            <AlertDialogCancel>Cancel</AlertDialogCancel>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    );

    const footer = screen.getByTestId("footer");
    expect(footer.className).toContain("pt-4");
  });
});

describe("AlertDialogContent", () => {
  it("uses flex-col layout", () => {
    render(
      <AlertDialog open>
        <AlertDialogContent data-testid="content">Content</AlertDialogContent>
      </AlertDialog>
    );

    const content = screen.getByTestId("content");
    expect(content.className).toContain("flex");
    expect(content.className).toContain("flex-col");
  });
});
