/**
 * Unit tests for SwipeableTabs component.
 * Tests tab rendering, keyboard navigation, ARIA attributes,
 * screen reader announcements, and lazy rendering behavior.
 */

import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { SwipeableTabs } from "@/components/mobile/swipeable-tabs";

// Mock motion/react (animation library)
vi.mock("motion/react", () => ({
  motion: {
    div: ({
      children,
      custom: _custom,
      initial: _initial,
      animate: _animate,
      exit: _exit,
      transition: _transition,
      drag: _drag,
      dragConstraints: _dragConstraints,
      dragElastic: _dragElastic,
      onDragEnd: _onDragEnd,
      layoutId: _layoutId,
      ...domProps
    }: Record<string, unknown>) => {
      return <div {...domProps}>{children as React.ReactNode}</div>;
    },
  },
  AnimatePresence: ({ children }: { children: React.ReactNode }) => (
    <>{children}</>
  ),
}));

// Mock reduced motion hook
vi.mock("@/hooks/use-reduced-motion", () => ({
  usePrefersReducedMotion: () => false,
}));

const mockTabs = [
  { id: "tab1", label: "First", content: <div>Content 1</div> },
  { id: "tab2", label: "Second", content: <div>Content 2</div> },
  { id: "tab3", label: "Third", content: <div>Content 3</div> },
];

describe("SwipeableTabs", () => {
  it("renders all tab buttons", () => {
    render(
      <SwipeableTabs tabs={mockTabs} activeTab="tab1" onTabChange={vi.fn()} />
    );

    const tabs = screen.getAllByRole("tab");
    expect(tabs).toHaveLength(3);
    expect(tabs[0]).toHaveTextContent("First");
    expect(tabs[1]).toHaveTextContent("Second");
    expect(tabs[2]).toHaveTextContent("Third");
  });

  it("marks active tab with aria-selected=true", () => {
    render(
      <SwipeableTabs tabs={mockTabs} activeTab="tab2" onTabChange={vi.fn()} />
    );

    const tabs = screen.getAllByRole("tab");
    expect(tabs[0]).toHaveAttribute("aria-selected", "false");
    expect(tabs[1]).toHaveAttribute("aria-selected", "true");
    expect(tabs[2]).toHaveAttribute("aria-selected", "false");
  });

  it("inactive tabs have tabIndex=-1", () => {
    render(
      <SwipeableTabs tabs={mockTabs} activeTab="tab1" onTabChange={vi.fn()} />
    );

    const tabs = screen.getAllByRole("tab");
    expect(tabs[0]).toHaveAttribute("tabindex", "0");
    expect(tabs[1]).toHaveAttribute("tabindex", "-1");
    expect(tabs[2]).toHaveAttribute("tabindex", "-1");
  });

  it("calls onTabChange when tab is clicked", async () => {
    const user = userEvent.setup();
    const onTabChange = vi.fn();

    render(
      <SwipeableTabs
        tabs={mockTabs}
        activeTab="tab1"
        onTabChange={onTabChange}
      />
    );

    await user.click(screen.getByRole("tab", { name: "Second" }));
    expect(onTabChange).toHaveBeenCalledWith("tab2");
  });

  it("shows active tab content", () => {
    render(
      <SwipeableTabs tabs={mockTabs} activeTab="tab2" onTabChange={vi.fn()} />
    );

    const panels = screen.getAllByRole("tabpanel");
    expect(panels[0]).toHaveClass("hidden");
    expect(panels[1]).toHaveClass("block");
    expect(panels[2]).toHaveClass("hidden");
  });

  it("applies custom aria-label to tablist", () => {
    render(
      <SwipeableTabs
        tabs={mockTabs}
        activeTab="tab1"
        onTabChange={vi.fn()}
        ariaLabel="Custom"
      />
    );

    const tablist = screen.getByRole("tablist");
    expect(tablist).toHaveAttribute("aria-label", "Custom");
  });

  it("handles ArrowRight keyboard navigation", async () => {
    const user = userEvent.setup();
    const onTabChange = vi.fn();

    render(
      <SwipeableTabs
        tabs={mockTabs}
        activeTab="tab1"
        onTabChange={onTabChange}
      />
    );

    const firstTab = screen.getByRole("tab", { name: "First" });
    firstTab.focus();
    await user.keyboard("{ArrowRight}");

    expect(onTabChange).toHaveBeenCalledWith("tab2");
  });

  it("handles ArrowLeft keyboard navigation", async () => {
    const user = userEvent.setup();
    const onTabChange = vi.fn();

    render(
      <SwipeableTabs
        tabs={mockTabs}
        activeTab="tab2"
        onTabChange={onTabChange}
      />
    );

    const secondTab = screen.getByRole("tab", { name: "Second" });
    secondTab.focus();
    await user.keyboard("{ArrowLeft}");

    expect(onTabChange).toHaveBeenCalledWith("tab1");
  });

  it("ArrowRight wraps from last to first", async () => {
    const user = userEvent.setup();
    const onTabChange = vi.fn();

    render(
      <SwipeableTabs
        tabs={mockTabs}
        activeTab="tab3"
        onTabChange={onTabChange}
      />
    );

    const lastTab = screen.getByRole("tab", { name: "Third" });
    lastTab.focus();
    await user.keyboard("{ArrowRight}");

    expect(onTabChange).toHaveBeenCalledWith("tab1");
  });

  it("ArrowLeft wraps from first to last", async () => {
    const user = userEvent.setup();
    const onTabChange = vi.fn();

    render(
      <SwipeableTabs
        tabs={mockTabs}
        activeTab="tab1"
        onTabChange={onTabChange}
      />
    );

    const firstTab = screen.getByRole("tab", { name: "First" });
    firstTab.focus();
    await user.keyboard("{ArrowLeft}");

    expect(onTabChange).toHaveBeenCalledWith("tab3");
  });

  it("Home key navigates to first tab", async () => {
    const user = userEvent.setup();
    const onTabChange = vi.fn();

    render(
      <SwipeableTabs
        tabs={mockTabs}
        activeTab="tab3"
        onTabChange={onTabChange}
      />
    );

    const lastTab = screen.getByRole("tab", { name: "Third" });
    lastTab.focus();
    await user.keyboard("{Home}");

    expect(onTabChange).toHaveBeenCalledWith("tab1");
  });

  it("End key navigates to last tab", async () => {
    const user = userEvent.setup();
    const onTabChange = vi.fn();

    render(
      <SwipeableTabs
        tabs={mockTabs}
        activeTab="tab1"
        onTabChange={onTabChange}
      />
    );

    const firstTab = screen.getByRole("tab", { name: "First" });
    firstTab.focus();
    await user.keyboard("{End}");

    expect(onTabChange).toHaveBeenCalledWith("tab3");
  });

  it("tab panels have correct aria-labelledby", () => {
    render(
      <SwipeableTabs tabs={mockTabs} activeTab="tab1" onTabChange={vi.fn()} />
    );

    const tabs = screen.getAllByRole("tab");
    const panels = screen.getAllByRole("tabpanel");

    // Each panel's aria-labelledby should match its corresponding tab's id
    panels.forEach((panel, index) => {
      const tabId = tabs[index].getAttribute("id");
      expect(panel).toHaveAttribute("aria-labelledby", tabId);
    });
  });

  it("announces tab change to screen readers", async () => {
    const user = userEvent.setup();
    const onTabChange = vi.fn();

    render(
      <SwipeableTabs
        tabs={mockTabs}
        activeTab="tab1"
        onTabChange={onTabChange}
      />
    );

    await user.click(screen.getByRole("tab", { name: "Second" }));

    const liveRegion = document.querySelector('[aria-live="polite"]');
    expect(liveRegion).toBeInTheDocument();
    expect(liveRegion).toHaveTextContent("Second tab selected");
  });
});
