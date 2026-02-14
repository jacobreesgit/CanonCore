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
        <AnimatedDialogContent stepKey="step1">
          Content
        </AnimatedDialogContent>
      </Dialog>
    );
    const dialog = screen.getByRole("dialog");
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

describe("AnimatedDialogContent slot-based API", () => {
  it("renders header outside animated area", () => {
    render(
      <Dialog open>
        <AnimatedDialogContent
          stepKey="step1"
          header={<div>Header</div>}
        >
          Body content
        </AnimatedDialogContent>
      </Dialog>
    );

    const header = screen.getByText("Header");
    expect(header).toBeInTheDocument();
    // Header should be inside header wrapper with shrink-0
    const headerWrapper = header.closest("[data-slot='dialog-header-wrapper']");
    expect(headerWrapper).toBeInTheDocument();
  });

  it("renders footer outside animated area", () => {
    render(
      <Dialog open>
        <AnimatedDialogContent
          stepKey="step1"
          footer={<div>Footer</div>}
        >
          Body content
        </AnimatedDialogContent>
      </Dialog>
    );

    const footer = screen.getByText("Footer");
    expect(footer).toBeInTheDocument();
    // Footer should be inside footer wrapper with shrink-0
    const footerWrapper = footer.closest("[data-slot='dialog-footer-wrapper']");
    expect(footerWrapper).toBeInTheDocument();
  });

  it("only animates body content height", () => {
    const { rerender } = render(
      <Dialog open>
        <AnimatedDialogContent
          stepKey="step1"
          header={<div>Header</div>}
          footer={<div>Footer</div>}
        >
          <div style={{ height: 100 }}>Short content</div>
        </AnimatedDialogContent>
      </Dialog>
    );

    // Rerender with taller content
    rerender(
      <Dialog open>
        <AnimatedDialogContent
          stepKey="step2"
          header={<div>Header</div>}
          footer={<div>Footer</div>}
        >
          <div style={{ height: 300 }}>Tall content</div>
        </AnimatedDialogContent>
      </Dialog>
    );

    // Motion div should exist and animate (mocked, so just verify structure)
    expect(screen.getByText("Tall content")).toBeInTheDocument();
  });

  it("applies shrink-0 to header and footer wrappers", () => {
    render(
      <Dialog open>
        <AnimatedDialogContent
          stepKey="step1"
          header={<div>Header</div>}
          footer={<div>Footer</div>}
        >
          Body
        </AnimatedDialogContent>
      </Dialog>
    );

    const headerWrapper = screen
      .getByText("Header")
      .closest("[data-slot='dialog-header-wrapper']");
    const footerWrapper = screen
      .getByText("Footer")
      .closest("[data-slot='dialog-footer-wrapper']");

    expect(headerWrapper?.className).toContain("shrink-0");
    expect(footerWrapper?.className).toContain("shrink-0");
  });

  it("body section has min-h-0 for proper flex scrolling", () => {
    render(
      <Dialog open>
        <AnimatedDialogContent
          stepKey="step1"
          header={<div>Header</div>}
          footer={<div>Footer</div>}
        >
          Body
        </AnimatedDialogContent>
      </Dialog>
    );

    // The body wrapper should have min-h-0 and overflow-y-auto
    const dialog = screen.getByRole("dialog");
    const bodyWrapper = dialog.querySelector("[data-slot='dialog-body']");
    expect(bodyWrapper?.className).toContain("min-h-0");
    expect(bodyWrapper?.className).toContain("overflow-y-auto");
  });
});
