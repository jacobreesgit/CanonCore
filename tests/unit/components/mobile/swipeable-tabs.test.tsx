/**
 * Unit tests for SwipeableTabs component.
 * Tests tab rendering, keyboard navigation, ARIA attributes,
 * screen reader announcements, lazy rendering behavior,
 * and Select dropdown mode for >3 tabs.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, act, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Settings2, Film, Sparkles, User, Lock } from "lucide-react";
import { SwipeableTabs } from "@/components/mobile/swipeable-tabs";

// ---------------------------------------------------------------------------
// Mock embla-carousel-react
// ---------------------------------------------------------------------------

type EmblaCallback = () => void;

let mockScrollTo: ReturnType<typeof vi.fn>;
let mockSelectedScrollSnap: ReturnType<typeof vi.fn>;
let mockListeners: Map<string, Set<EmblaCallback>>;
let mockEmblaApi: {
  scrollTo: ReturnType<typeof vi.fn>;
  selectedScrollSnap: ReturnType<typeof vi.fn>;
  on: ReturnType<typeof vi.fn>;
  off: ReturnType<typeof vi.fn>;
  emit: (event: string) => void;
} | null = null;

function createMockApi(startIndex = 0) {
  mockListeners = new Map();
  mockScrollTo = vi.fn((index: number) => {
    mockSelectedScrollSnap.mockReturnValue(index);
    // Fire select event listeners after scrollTo
    const listeners = mockListeners.get("select");
    if (listeners) {
      listeners.forEach((cb) => cb());
    }
  });
  mockSelectedScrollSnap = vi.fn().mockReturnValue(startIndex);

  mockEmblaApi = {
    scrollTo: mockScrollTo,
    selectedScrollSnap: mockSelectedScrollSnap,
    on: vi.fn((event: string, cb: EmblaCallback) => {
      if (!mockListeners.has(event)) {
        mockListeners.set(event, new Set());
      }
      mockListeners.get(event)!.add(cb);
      return mockEmblaApi;
    }),
    off: vi.fn((event: string, cb: EmblaCallback) => {
      mockListeners.get(event)?.delete(cb);
      return mockEmblaApi;
    }),
    emit: (event: string) => {
      const listeners = mockListeners.get(event);
      if (listeners) {
        listeners.forEach((cb) => cb());
      }
    },
  };

  return mockEmblaApi;
}

vi.mock("embla-carousel-react", () => ({
  default: (options?: { startIndex?: number }) => {
    // Reuse existing API across re-renders (matches real Embla behavior)
    if (!mockEmblaApi) {
      createMockApi(options?.startIndex ?? 0);
    }
    return [() => {}, mockEmblaApi];
  },
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

beforeEach(() => {
  mockEmblaApi = null;
  vi.clearAllMocks();
});

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

  it("calls scrollTo when tab is clicked", async () => {
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
    expect(mockScrollTo).toHaveBeenCalledWith(1);
  });

  it("select event handler calls onTabChange", () => {
    const onTabChange = vi.fn();

    render(
      <SwipeableTabs
        tabs={mockTabs}
        activeTab="tab1"
        onTabChange={onTabChange}
      />
    );

    // Simulate a swipe by changing the snap and firing select event
    act(() => {
      mockSelectedScrollSnap.mockReturnValue(1);
      mockEmblaApi!.emit("select");
    });

    expect(onTabChange).toHaveBeenCalledWith("tab2");
  });

  it("inactive slides have inert attribute", () => {
    render(
      <SwipeableTabs tabs={mockTabs} activeTab="tab2" onTabChange={vi.fn()} />
    );

    const panels = screen.getAllByRole("tabpanel", { hidden: true });
    // Active panel (tab2) should NOT have inert
    const activePanel = panels.find((p) =>
      p.getAttribute("aria-labelledby")?.includes("tab2")
    );
    expect(activePanel).not.toHaveAttribute("inert");

    // Inactive panels should have inert
    const inactivePanels = panels.filter(
      (p) => !p.getAttribute("aria-labelledby")?.includes("tab2")
    );
    for (const panel of inactivePanels) {
      expect(panel).toHaveAttribute("inert");
    }
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

    expect(mockScrollTo).toHaveBeenCalledWith(1);
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

    expect(mockScrollTo).toHaveBeenCalledWith(0);
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

    expect(mockScrollTo).toHaveBeenCalledWith(0);
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

    expect(mockScrollTo).toHaveBeenCalledWith(2);
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

    expect(mockScrollTo).toHaveBeenCalledWith(0);
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

    expect(mockScrollTo).toHaveBeenCalledWith(2);
  });

  it("tab panels have correct aria-labelledby", () => {
    render(
      <SwipeableTabs tabs={mockTabs} activeTab="tab1" onTabChange={vi.fn()} />
    );

    const tabs = screen.getAllByRole("tab");
    const panels = screen.getAllByRole("tabpanel", { hidden: true });

    // Each panel's aria-labelledby should match its corresponding tab's id
    panels.forEach((panel, index) => {
      const tabId = tabs[index].getAttribute("id");
      expect(panel).toHaveAttribute("aria-labelledby", tabId);
    });
  });

  it("announces tab change to screen readers", () => {
    const onTabChange = vi.fn();

    render(
      <SwipeableTabs
        tabs={mockTabs}
        activeTab="tab1"
        onTabChange={onTabChange}
      />
    );

    // Simulate Embla selecting tab2 (e.g. from a swipe)
    act(() => {
      mockSelectedScrollSnap.mockReturnValue(1);
      mockEmblaApi!.emit("select");
    });

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
