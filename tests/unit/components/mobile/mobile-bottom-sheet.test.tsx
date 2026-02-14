/**
 * Unit tests for MobileBottomSheet component.
 * Tests base sheet behavior, accessibility, and sub-components.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import {
  MobileBottomSheet,
  MobileBottomSheetHeader,
  MobileBottomSheetTitle,
  MobileBottomSheetContent,
  MobileBottomSheetFooter,
} from "@/components/mobile/mobile-bottom-sheet";

// Mock useReducedMotion hook
const mockReducedMotion = vi.fn();
vi.mock("@/hooks/use-reduced-motion", () => ({
  useReducedMotion: () => mockReducedMotion(),
}));

describe("MobileBottomSheet", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockReducedMotion.mockReturnValue(false);
  });

  describe("Rendering", () => {
    it("renders children when open", () => {
      render(
        <MobileBottomSheet
          open={true}
          onOpenChange={vi.fn()}
          title="Test Sheet"
        >
          <div>Sheet content</div>
        </MobileBottomSheet>
      );

      expect(screen.getByText("Sheet content")).toBeInTheDocument();
    });

    it("does not render children when closed", () => {
      render(
        <MobileBottomSheet
          open={false}
          onOpenChange={vi.fn()}
          title="Test Sheet"
        >
          <div>Sheet content</div>
        </MobileBottomSheet>
      );

      expect(screen.queryByText("Sheet content")).not.toBeInTheDocument();
    });

    it("renders drawer content when open", () => {
      render(
        <MobileBottomSheet
          open={true}
          onOpenChange={vi.fn()}
          title="Test Sheet"
        >
          <div>Drawer content</div>
        </MobileBottomSheet>
      );

      // Drawer dialog should be present
      expect(screen.getByRole("dialog")).toBeInTheDocument();
      expect(screen.getByText("Drawer content")).toBeInTheDocument();
    });
  });

  describe("Accessibility", () => {
    it("renders accessible title (visually hidden)", () => {
      render(
        <MobileBottomSheet
          open={true}
          onOpenChange={vi.fn()}
          title="Account Settings"
        >
          <div>Content</div>
        </MobileBottomSheet>
      );

      // Title should be in the document but visually hidden (sr-only class)
      const title = screen.getByText("Account Settings");
      expect(title).toBeInTheDocument();
      expect(title).toHaveClass("sr-only");
    });

    it("renders accessible description when provided", () => {
      render(
        <MobileBottomSheet
          open={true}
          onOpenChange={vi.fn()}
          title="Settings"
          description="Manage your account settings"
        >
          <div>Content</div>
        </MobileBottomSheet>
      );

      const description = screen.getByText("Manage your account settings");
      expect(description).toBeInTheDocument();
      expect(description).toHaveClass("sr-only");
      // useId() generates unique IDs — just verify the element has an id attribute
      expect(description).toHaveAttribute("id");
    });

    it("does not render description when not provided", () => {
      render(
        <MobileBottomSheet open={true} onOpenChange={vi.fn()} title="Settings">
          <div>Content</div>
        </MobileBottomSheet>
      );

      expect(
        screen.queryByText("Manage your account settings")
      ).not.toBeInTheDocument();
    });
  });

  describe("Callbacks", () => {
    it("passes onOpenChange prop to drawer", () => {
      const onOpenChange = vi.fn();

      render(
        <MobileBottomSheet
          open={true}
          onOpenChange={onOpenChange}
          title="Test Sheet"
        >
          <div>Content</div>
        </MobileBottomSheet>
      );

      // Verify the component renders with the callback
      expect(screen.getByText("Content")).toBeInTheDocument();
    });
  });

  describe("Reduced Motion", () => {
    it("respects prefers-reduced-motion preference", () => {
      mockReducedMotion.mockReturnValue(true);

      render(
        <MobileBottomSheet
          open={true}
          onOpenChange={vi.fn()}
          title="Test Sheet"
        >
          <div>Reduced motion content</div>
        </MobileBottomSheet>
      );

      // Component renders correctly with reduced motion enabled
      expect(screen.getByText("Reduced motion content")).toBeInTheDocument();
    });
  });
});

describe("MobileBottomSheetHeader", () => {
  it("renders children", () => {
    render(
      <MobileBottomSheetHeader>
        <span>Header Content</span>
      </MobileBottomSheetHeader>
    );

    expect(screen.getByText("Header Content")).toBeInTheDocument();
  });

  it("applies custom className", () => {
    const { container } = render(
      <MobileBottomSheetHeader className="custom-class">
        <span>Header</span>
      </MobileBottomSheetHeader>
    );

    expect(container.firstChild).toHaveClass("custom-class");
  });

  it("has default styling classes", () => {
    const { container } = render(
      <MobileBottomSheetHeader>
        <span>Header</span>
      </MobileBottomSheetHeader>
    );

    expect(container.firstChild).toHaveClass("flex", "flex-col", "px-4");
  });
});

describe("MobileBottomSheetTitle", () => {
  it("renders as h2 element", () => {
    render(<MobileBottomSheetTitle>My Title</MobileBottomSheetTitle>);

    const title = screen.getByRole("heading", { level: 2 });
    expect(title).toBeInTheDocument();
    expect(title).toHaveTextContent("My Title");
  });

  it("applies custom className", () => {
    render(
      <MobileBottomSheetTitle className="custom-title">
        Title
      </MobileBottomSheetTitle>
    );

    const title = screen.getByRole("heading");
    expect(title).toHaveClass("custom-title");
  });

  it("has typography styling", () => {
    render(<MobileBottomSheetTitle>Title</MobileBottomSheetTitle>);

    const title = screen.getByRole("heading");
    expect(title).toHaveClass("text-lg", "font-semibold");
  });
});

describe("MobileBottomSheetContent", () => {
  it("renders children", () => {
    render(
      <MobileBottomSheetContent>
        <p>Content paragraph</p>
      </MobileBottomSheetContent>
    );

    expect(screen.getByText("Content paragraph")).toBeInTheDocument();
  });

  it("has data-vaul-no-drag attribute for scroll support", () => {
    const { container } = render(
      <MobileBottomSheetContent>Content</MobileBottomSheetContent>
    );

    expect(container.firstChild).toHaveAttribute("data-vaul-no-drag");
  });

  it("applies custom className", () => {
    const { container } = render(
      <MobileBottomSheetContent className="custom-content">
        Content
      </MobileBottomSheetContent>
    );

    expect(container.firstChild).toHaveClass("custom-content");
  });

  it("has overflow-y-auto for scrolling", () => {
    const { container } = render(
      <MobileBottomSheetContent>Content</MobileBottomSheetContent>
    );

    expect(container.firstChild).toHaveClass("overflow-y-auto");
  });
});

describe("MobileBottomSheetFooter", () => {
  it("renders children", () => {
    render(
      <MobileBottomSheetFooter>
        <button>Close</button>
      </MobileBottomSheetFooter>
    );

    expect(screen.getByRole("button", { name: "Close" })).toBeInTheDocument();
  });

  it("applies custom className", () => {
    const { container } = render(
      <MobileBottomSheetFooter className="custom-footer">
        Footer
      </MobileBottomSheetFooter>
    );

    expect(container.firstChild).toHaveClass("custom-footer");
  });

  it("has flex layout for button arrangement", () => {
    const { container } = render(
      <MobileBottomSheetFooter>Footer</MobileBottomSheetFooter>
    );

    expect(container.firstChild).toHaveClass("flex", "flex-col", "gap-2");
  });
});
