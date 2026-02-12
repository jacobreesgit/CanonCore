/**
 * Unit tests for SwipeableTabs component.
 * Tests tab rendering, keyboard navigation, ARIA attributes,
 * screen reader announcements, lazy rendering behavior,
 * and Select dropdown mode for >3 tabs.
 */

import { describe, it, expect, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Settings2, Film, Sparkles, User, Lock } from "lucide-react";
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

// =============================================================================
// Select mode (>3 tabs)
// =============================================================================

const selectModeTabs = [
  {
    id: "tab1",
    label: "Profile",
    icon: User,
    content: <div>Profile Content</div>,
  },
  {
    id: "tab2",
    label: "Account",
    icon: Lock,
    content: <div>Account Content</div>,
  },
  {
    id: "tab3",
    label: "Connections",
    icon: Settings2,
    content: <div>Connections Content</div>,
  },
  {
    id: "tab4",
    label: "Preferences",
    icon: Film,
    content: <div>Preferences Content</div>,
  },
  {
    id: "tab5",
    label: "Activity",
    icon: Sparkles,
    content: <div>Activity Content</div>,
  },
];

describe("SwipeableTabs — Select mode (>3 tabs)", () => {
  it("renders a Select trigger instead of tab buttons when >3 tabs", () => {
    render(
      <SwipeableTabs
        tabs={selectModeTabs}
        activeTab="tab1"
        onTabChange={vi.fn()}
      />
    );

    // Should have a combobox (Select trigger), not tab buttons
    expect(screen.getByRole("combobox")).toBeInTheDocument();
    expect(screen.queryAllByRole("tab")).toHaveLength(0);
    expect(screen.queryByRole("tablist")).not.toBeInTheDocument();
  });

  it("Select trigger has aria-label matching ariaLabel prop", () => {
    render(
      <SwipeableTabs
        tabs={selectModeTabs}
        activeTab="tab1"
        onTabChange={vi.fn()}
        ariaLabel="Settings tabs"
      />
    );

    expect(screen.getByRole("combobox")).toHaveAttribute(
      "aria-label",
      "Settings tabs"
    );
  });

  it("Select trigger shows active tab label", () => {
    render(
      <SwipeableTabs
        tabs={selectModeTabs}
        activeTab="tab1"
        onTabChange={vi.fn()}
      />
    );

    const trigger = screen.getByRole("combobox");
    expect(trigger).toHaveTextContent("Profile");
  });

  it("all tabs appear as options in the dropdown", async () => {
    const user = userEvent.setup({ pointerEventsCheck: 0 });

    render(
      <SwipeableTabs
        tabs={selectModeTabs}
        activeTab="tab1"
        onTabChange={vi.fn()}
      />
    );

    await user.click(screen.getByRole("combobox"));

    await waitFor(() => {
      const options = screen.getAllByRole("option");
      expect(options).toHaveLength(5);
    });
  });

  it("icons in trigger have aria-hidden=true", () => {
    render(
      <SwipeableTabs
        tabs={selectModeTabs}
        activeTab="tab1"
        onTabChange={vi.fn()}
      />
    );

    // The trigger's icon should have aria-hidden (set by our component)
    const trigger = screen.getByRole("combobox");
    const triggerSvg = trigger
      .closest("[data-slot='select-trigger']")
      ?.querySelector("svg[aria-hidden='true']");
    expect(triggerSvg).toBeInTheDocument();
  });

  it("calls onTabChange when a SelectItem is chosen", async () => {
    const user = userEvent.setup({ pointerEventsCheck: 0 });
    const onTabChange = vi.fn();

    render(
      <SwipeableTabs
        tabs={selectModeTabs}
        activeTab="tab1"
        onTabChange={onTabChange}
      />
    );

    await user.click(screen.getByRole("combobox"));

    await waitFor(() => {
      expect(screen.getAllByRole("option")).toHaveLength(5);
    });

    await user.click(screen.getByRole("option", { name: /Account/i }));

    expect(onTabChange).toHaveBeenCalledWith("tab2");
  });

  it("shows only active tab content, others hidden but not unmounted", () => {
    render(
      <SwipeableTabs
        tabs={selectModeTabs}
        activeTab="tab2"
        onTabChange={vi.fn()}
      />
    );

    // Active panel is visible
    const activePanel = screen.getByTestId("select-panel-tab2");
    expect(activePanel).toHaveClass("block");

    // Other panels exist in DOM but are hidden
    expect(screen.getByTestId("select-panel-tab1")).toHaveClass("hidden");
    expect(screen.getByTestId("select-panel-tab3")).toHaveClass("hidden");
    expect(screen.getByTestId("select-panel-tab4")).toHaveClass("hidden");
    expect(screen.getByTestId("select-panel-tab5")).toHaveClass("hidden");
  });

  it("lazy rendering — unvisited tab content not mounted until selected", () => {
    render(
      <SwipeableTabs
        tabs={selectModeTabs}
        activeTab="tab1"
        onTabChange={vi.fn()}
        lazy
      />
    );

    // Active tab content is rendered
    expect(screen.getByText("Profile Content")).toBeInTheDocument();

    // Unvisited tabs should NOT have content rendered
    expect(screen.queryByText("Account Content")).not.toBeInTheDocument();
    expect(screen.queryByText("Connections Content")).not.toBeInTheDocument();
    expect(screen.queryByText("Preferences Content")).not.toBeInTheDocument();
    expect(screen.queryByText("Activity Content")).not.toBeInTheDocument();
  });

  it("aria-live region announces tab changes", async () => {
    const user = userEvent.setup({ pointerEventsCheck: 0 });
    const onTabChange = vi.fn();

    render(
      <SwipeableTabs
        tabs={selectModeTabs}
        activeTab="tab1"
        onTabChange={onTabChange}
      />
    );

    await user.click(screen.getByRole("combobox"));

    await waitFor(() => {
      expect(screen.getAllByRole("option")).toHaveLength(5);
    });

    await user.click(screen.getByRole("option", { name: /Preferences/i }));

    const liveRegion = document.querySelector('[aria-live="polite"]');
    expect(liveRegion).toBeInTheDocument();
    expect(liveRegion).toHaveTextContent("Preferences tab selected");
  });

  it("content panels have role=tabpanel in Select mode", () => {
    render(
      <SwipeableTabs
        tabs={selectModeTabs}
        activeTab="tab1"
        onTabChange={vi.fn()}
      />
    );

    expect(screen.queryAllByRole("tabpanel")).toHaveLength(5);
  });

  it("exactly 3 tabs still renders swipeable tabs", () => {
    render(
      <SwipeableTabs tabs={mockTabs} activeTab="tab1" onTabChange={vi.fn()} />
    );

    // Should have tab buttons and tablist, not combobox
    expect(screen.queryByRole("combobox")).not.toBeInTheDocument();
    expect(screen.getByRole("tablist")).toBeInTheDocument();
    expect(screen.getAllByRole("tab")).toHaveLength(3);
  });
});
