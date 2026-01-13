/**
 * Unit tests for AnimatedDialogContent component.
 * Tests animated height transitions between dialog steps.
 */

import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { AnimatedDialogContent } from "@/components/ui/animated-dialog-content";
import { Dialog } from "@/components/ui/dialog";

// Mock motion/react to avoid animation timing issues in tests
vi.mock("motion/react", () => ({
  motion: {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    div: ({ children, ...props }: any) => <div {...props}>{children}</div>,
  },
  AnimatePresence: ({ children }: { children: React.ReactNode }) => (
    <>{children}</>
  ),
  useReducedMotion: () => false,
}));

describe("AnimatedDialogContent", () => {
  it("renders children", () => {
    render(
      <Dialog open>
        <AnimatedDialogContent stepKey="step1">
          <div>Test Content</div>
        </AnimatedDialogContent>
      </Dialog>
    );
    expect(screen.getByText("Test Content")).toBeInTheDocument();
  });

  it("applies consistent width class", () => {
    render(
      <Dialog open>
        <AnimatedDialogContent stepKey="step1" data-testid="dialog">
          Content
        </AnimatedDialogContent>
      </Dialog>
    );
    const dialog = screen.getByTestId("dialog");
    expect(dialog.className).toContain("sm:max-w-lg");
  });

  it("accepts custom className", () => {
    render(
      <Dialog open>
        <AnimatedDialogContent stepKey="step1" className="custom-class">
          Content
        </AnimatedDialogContent>
      </Dialog>
    );
    expect(document.querySelector(".custom-class")).toBeInTheDocument();
  });

  it("shows close button by default", () => {
    render(
      <Dialog open>
        <AnimatedDialogContent stepKey="step1">Content</AnimatedDialogContent>
      </Dialog>
    );
    expect(screen.getByRole("button", { name: /close/i })).toBeInTheDocument();
  });

  it("hides close button when showClose is false", () => {
    render(
      <Dialog open>
        <AnimatedDialogContent stepKey="step1" showClose={false}>
          Content
        </AnimatedDialogContent>
      </Dialog>
    );
    expect(
      screen.queryByRole("button", { name: /close/i })
    ).not.toBeInTheDocument();
  });

  it("renders dialog role", () => {
    render(
      <Dialog open>
        <AnimatedDialogContent stepKey="step1">Content</AnimatedDialogContent>
      </Dialog>
    );
    expect(screen.getByRole("dialog")).toBeInTheDocument();
  });
});
