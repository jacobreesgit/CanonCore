/**
 * Unit tests for SpotlightSearch component.
 * Tests rendering, item loading, and navigation.
 */

import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  SpotlightSearch,
  clearSearchCache,
} from "@/components/search/spotlight-search";
import { SpotlightProvider } from "@/contexts/spotlight-context";

// Mock next/navigation
const mockPush = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: mockPush }),
}));

// Mock getSearchableItems server action
vi.mock("@/lib/item-actions", () => ({
  getSearchableItems: vi.fn(),
}));

import { getSearchableItems } from "@/lib/item-actions";

describe("SpotlightSearch", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    clearSearchCache();
    vi.mocked(getSearchableItems).mockResolvedValue({
      success: true,
      data: [],
    });
  });

  it("renders when open", async () => {
    render(
      <SpotlightProvider>
        <SpotlightSearch defaultOpen={true} />
      </SpotlightProvider>
    );

    await waitFor(() => {
      expect(screen.getByRole("dialog")).toBeInTheDocument();
    });
    expect(screen.getByPlaceholderText(/search items/i)).toBeInTheDocument();
  });

  it("does not render when closed", () => {
    render(
      <SpotlightProvider>
        <SpotlightSearch />
      </SpotlightProvider>
    );

    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("fetches items when dialog opens", async () => {
    vi.mocked(getSearchableItems).mockResolvedValue({
      success: true,
      data: [
        {
          id: "1",
          name: "Item 1",
          parentId: null,
          depth: 0,
          description: null,
          artworkId: null,
          breadcrumb: null,
        },
      ],
    });

    render(
      <SpotlightProvider>
        <SpotlightSearch defaultOpen={true} />
      </SpotlightProvider>
    );

    await waitFor(() => {
      expect(getSearchableItems).toHaveBeenCalledTimes(1);
    });
  });

  it("shows empty state when no items exist", async () => {
    vi.mocked(getSearchableItems).mockResolvedValue({
      success: true,
      data: [],
    });

    render(
      <SpotlightProvider>
        <SpotlightSearch defaultOpen={true} />
      </SpotlightProvider>
    );

    await waitFor(() => {
      // Use getAllByText since there's both visible text and sr-only announcement
      const elements = screen.getAllByText(/no items found/i);
      expect(elements.length).toBeGreaterThan(0);
    });
  });

  it("displays all items initially (cmdk filters as user types)", async () => {
    vi.mocked(getSearchableItems).mockResolvedValue({
      success: true,
      data: [
        {
          id: "item-1",
          name: "Star Wars",
          parentId: null,
          depth: 0,
          description: null,
          artworkId: null,
          breadcrumb: null,
        },
        {
          id: "item-2",
          name: "Empire Strikes Back",
          parentId: null,
          depth: 0,
          description: null,
          artworkId: null,
          breadcrumb: null,
        },
      ],
    });

    render(
      <SpotlightProvider>
        <SpotlightSearch defaultOpen={true} />
      </SpotlightProvider>
    );

    await waitFor(() => {
      expect(screen.getByText("Star Wars")).toBeInTheDocument();
      expect(screen.getByText("Empire Strikes Back")).toBeInTheDocument();
    });
  });

  it("navigates to item on selection", async () => {
    const user = userEvent.setup();
    vi.mocked(getSearchableItems).mockResolvedValue({
      success: true,
      data: [
        {
          id: "item-123",
          name: "My Movie",
          parentId: null,
          depth: 0,
          description: null,
          artworkId: null,
          breadcrumb: null,
        },
      ],
    });

    render(
      <SpotlightProvider>
        <SpotlightSearch defaultOpen={true} />
      </SpotlightProvider>
    );

    await waitFor(() => {
      expect(screen.getByText("My Movie")).toBeInTheDocument();
    });

    await user.click(screen.getByText("My Movie"));

    expect(mockPush).toHaveBeenCalledWith("/my-items/item-123");
  });

  it("shows keyboard shortcut hint", async () => {
    render(
      <SpotlightProvider>
        <SpotlightSearch defaultOpen={true} />
      </SpotlightProvider>
    );

    await waitFor(() => {
      // Should show "/" hint
      expect(screen.getByText("/")).toBeInTheDocument();
    });
  });

  it("shows item description when available and no breadcrumb", async () => {
    vi.mocked(getSearchableItems).mockResolvedValue({
      success: true,
      data: [
        {
          id: "item-1",
          name: "My Item",
          parentId: null,
          depth: 0,
          description: "A great description",
          artworkId: null,
          breadcrumb: null,
        },
      ],
    });

    render(
      <SpotlightProvider>
        <SpotlightSearch defaultOpen={true} />
      </SpotlightProvider>
    );

    await waitFor(() => {
      expect(screen.getByText("A great description")).toBeInTheDocument();
    });
  });

  it("handles fetch error gracefully", async () => {
    vi.mocked(getSearchableItems).mockResolvedValue({
      error: "Failed to fetch",
    });

    render(
      <SpotlightProvider>
        <SpotlightSearch defaultOpen={true} />
      </SpotlightProvider>
    );

    await waitFor(() => {
      // Use getAllByText since there's both visible text and sr-only announcement
      const elements = screen.getAllByText(/no items found/i);
      expect(elements.length).toBeGreaterThan(0);
    });
  });

  it("shows loading state while fetching", async () => {
    let resolvePromise!: (
      value: Awaited<ReturnType<typeof getSearchableItems>>
    ) => void;
    vi.mocked(getSearchableItems).mockImplementation(
      () =>
        new Promise((resolve) => {
          resolvePromise = resolve;
        })
    );

    render(
      <SpotlightProvider>
        <SpotlightSearch defaultOpen={true} />
      </SpotlightProvider>
    );

    // Use getAllByText since there's both visible text and sr-only announcement
    expect(screen.getAllByText(/loading/i).length).toBeGreaterThan(0);

    resolvePromise({ success: true, data: [] });

    await waitFor(() => {
      expect(screen.queryAllByText(/loading/i).length).toBe(0);
    });
  });

  it("displays artwork thumbnail when artworkId is present", async () => {
    vi.mocked(getSearchableItems).mockResolvedValue({
      success: true,
      data: [
        {
          id: "item-1",
          name: "Star Wars",
          parentId: null,
          depth: 0,
          description: null,
          artworkId: "artwork-123",
          breadcrumb: null,
        },
      ],
    });

    render(
      <SpotlightProvider>
        <SpotlightSearch defaultOpen={true} />
      </SpotlightProvider>
    );

    // Wait for item to be rendered
    await waitFor(() => {
      expect(screen.getByText("Star Wars")).toBeInTheDocument();
    });

    // Dialog uses a portal, so query document directly (not container)
    const img = document.querySelector('img[src="/api/artwork/artwork-123"]');
    expect(img).toBeInTheDocument();
  });

  it("displays breadcrumb path for nested items", async () => {
    vi.mocked(getSearchableItems).mockResolvedValue({
      success: true,
      data: [
        {
          id: "item-1",
          name: "Deleted Scenes",
          parentId: "parent-1",
          depth: 2,
          description: null,
          artworkId: null,
          breadcrumb: "Movies / Star Wars",
        },
      ],
    });

    render(
      <SpotlightProvider>
        <SpotlightSearch defaultOpen={true} />
      </SpotlightProvider>
    );

    await waitFor(() => {
      expect(screen.getByText("Movies / Star Wars")).toBeInTheDocument();
    });
  });

  it("prioritizes breadcrumb over description when both are present", async () => {
    vi.mocked(getSearchableItems).mockResolvedValue({
      success: true,
      data: [
        {
          id: "item-1",
          name: "Deleted Scenes",
          parentId: "parent-1",
          depth: 2,
          description: "Extra footage",
          artworkId: null,
          breadcrumb: "Movies / Star Wars",
        },
      ],
    });

    render(
      <SpotlightProvider>
        <SpotlightSearch defaultOpen={true} />
      </SpotlightProvider>
    );

    await waitFor(() => {
      expect(screen.getByText("Movies / Star Wars")).toBeInTheDocument();
      // Description should not be shown when breadcrumb is present
      expect(screen.queryByText("Extra footage")).not.toBeInTheDocument();
    });
  });

  it("uses folder icon when no artwork is present", async () => {
    vi.mocked(getSearchableItems).mockResolvedValue({
      success: true,
      data: [
        {
          id: "item-1",
          name: "My Folder",
          parentId: null,
          depth: 0,
          description: null,
          artworkId: null,
          breadcrumb: null,
        },
      ],
    });

    render(
      <SpotlightProvider>
        <SpotlightSearch defaultOpen={true} />
      </SpotlightProvider>
    );

    await waitFor(() => {
      expect(screen.getByText("My Folder")).toBeInTheDocument();
    });

    // Dialog uses a portal, so query document directly
    // Should not have an artwork img element (only icon)
    expect(
      document.querySelector('img[src^="/api/artwork/"]')
    ).not.toBeInTheDocument();
  });
});
