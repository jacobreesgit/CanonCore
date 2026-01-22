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

// Mock public-auth server actions
vi.mock("@/lib/public-auth", () => ({
  searchPublicUsers: vi.fn(),
  searchPublicItems: vi.fn(),
}));

import { getSearchableItems } from "@/lib/item-actions";
import { searchPublicUsers, searchPublicItems } from "@/lib/public-auth";

describe("SpotlightSearch", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    clearSearchCache();
    vi.mocked(getSearchableItems).mockResolvedValue({
      success: true,
      data: [],
    });
    vi.mocked(searchPublicUsers).mockResolvedValue({
      success: true,
      data: [],
    });
    vi.mocked(searchPublicItems).mockResolvedValue({
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
    expect(
      screen.getByPlaceholderText(/search items and people/i)
    ).toBeInTheDocument();
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
          ownerUsername: "testuser",
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
      const elements = screen.getAllByText(/no results found/i);
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
          ownerUsername: "testuser",
        },
        {
          id: "item-2",
          name: "Empire Strikes Back",
          parentId: null,
          depth: 0,
          description: null,
          artworkId: null,
          breadcrumb: null,
          ownerUsername: "testuser",
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
          ownerUsername: "testuser",
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

    expect(mockPush).toHaveBeenCalledWith("/u/testuser/item-123");
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
          ownerUsername: "testuser",
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
      const elements = screen.getAllByText(/no results found/i);
      expect(elements.length).toBeGreaterThan(0);
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
          ownerUsername: "testuser",
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
          ownerUsername: "testuser",
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
          ownerUsername: "testuser",
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
          ownerUsername: "testuser",
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

describe("SpotlightSearch - Public User Search", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    clearSearchCache();
    vi.mocked(getSearchableItems).mockResolvedValue({
      success: true,
      data: [],
    });
    vi.mocked(searchPublicUsers).mockResolvedValue({ success: true, data: [] });
    vi.mocked(searchPublicItems).mockResolvedValue({ success: true, data: [] });
  });

  it("fetches public users when dialog opens", async () => {
    render(
      <SpotlightProvider>
        <SpotlightSearch defaultOpen={true} />
      </SpotlightProvider>
    );

    await waitFor(() => {
      expect(searchPublicUsers).toHaveBeenCalledTimes(1);
    });
  });

  it("displays users in People section", async () => {
    vi.mocked(searchPublicUsers).mockResolvedValue({
      success: true,
      data: [
        {
          id: "user-1",
          username: "johndoe",
          name: "John Doe",
        },
      ],
    });

    render(
      <SpotlightProvider>
        <SpotlightSearch defaultOpen={true} />
      </SpotlightProvider>
    );

    await waitFor(() => {
      expect(screen.getByText("People")).toBeInTheDocument();
      expect(screen.getByText("John Doe")).toBeInTheDocument();
      expect(screen.getByText("@johndoe")).toBeInTheDocument();
    });
  });

  it("navigates to user profile on selection", async () => {
    const user = userEvent.setup();
    vi.mocked(searchPublicUsers).mockResolvedValue({
      success: true,
      data: [
        {
          id: "user-1",
          username: "johndoe",
          name: "John Doe",
        },
      ],
    });

    render(
      <SpotlightProvider>
        <SpotlightSearch defaultOpen={true} />
      </SpotlightProvider>
    );

    await waitFor(() => {
      expect(screen.getByText("John Doe")).toBeInTheDocument();
    });

    await user.click(screen.getByText("John Doe"));

    expect(mockPush).toHaveBeenCalledWith("/u/johndoe");
  });

  it("shows username as display name when user has no name", async () => {
    vi.mocked(searchPublicUsers).mockResolvedValue({
      success: true,
      data: [
        {
          id: "user-1",
          username: "johndoe",
          name: null,
        },
      ],
    });

    render(
      <SpotlightProvider>
        <SpotlightSearch defaultOpen={true} />
      </SpotlightProvider>
    );

    await waitFor(() => {
      expect(screen.getByText("johndoe")).toBeInTheDocument();
    });
  });
});

describe("SpotlightSearch - Public Item Search", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    clearSearchCache();
    vi.mocked(getSearchableItems).mockResolvedValue({
      success: true,
      data: [],
    });
    vi.mocked(searchPublicUsers).mockResolvedValue({ success: true, data: [] });
    vi.mocked(searchPublicItems).mockResolvedValue({ success: true, data: [] });
  });

  it("fetches public items when dialog opens", async () => {
    render(
      <SpotlightProvider>
        <SpotlightSearch defaultOpen={true} />
      </SpotlightProvider>
    );

    await waitFor(() => {
      expect(searchPublicItems).toHaveBeenCalledTimes(1);
    });
  });

  it("displays public items in Public Items section", async () => {
    vi.mocked(searchPublicItems).mockResolvedValue({
      success: true,
      data: [
        {
          id: "item-1",
          name: "Star Wars Collection",
          description: "Original trilogy",
          artworkId: null,
          ownerUsername: "johndoe",
          ownerName: "John Doe",
        },
      ],
    });

    render(
      <SpotlightProvider>
        <SpotlightSearch defaultOpen={true} />
      </SpotlightProvider>
    );

    await waitFor(() => {
      expect(screen.getByText("Public Items")).toBeInTheDocument();
      expect(screen.getByText("Star Wars Collection")).toBeInTheDocument();
      expect(screen.getByText("by @johndoe")).toBeInTheDocument();
    });
  });

  it("navigates to public item on selection", async () => {
    const user = userEvent.setup();
    vi.mocked(searchPublicItems).mockResolvedValue({
      success: true,
      data: [
        {
          id: "item-1",
          name: "Star Wars Collection",
          description: null,
          artworkId: null,
          ownerUsername: "johndoe",
          ownerName: "John Doe",
        },
      ],
    });

    render(
      <SpotlightProvider>
        <SpotlightSearch defaultOpen={true} />
      </SpotlightProvider>
    );

    await waitFor(() => {
      expect(screen.getByText("Star Wars Collection")).toBeInTheDocument();
    });

    await user.click(screen.getByText("Star Wars Collection"));

    expect(mockPush).toHaveBeenCalledWith("/u/johndoe/item-1");
  });
});

describe("SpotlightSearch - Cache", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    clearSearchCache();
    vi.mocked(getSearchableItems).mockResolvedValue({
      success: true,
      data: [],
    });
    vi.mocked(searchPublicUsers).mockResolvedValue({ success: true, data: [] });
    vi.mocked(searchPublicItems).mockResolvedValue({ success: true, data: [] });
  });

  it("uses cached data on subsequent opens within TTL", async () => {
    const { unmount } = render(
      <SpotlightProvider>
        <SpotlightSearch defaultOpen={true} />
      </SpotlightProvider>
    );

    await waitFor(() => {
      expect(searchPublicUsers).toHaveBeenCalledTimes(1);
    });

    // Close and unmount
    unmount();

    // Rerender (new mount, but cache is module-level)
    render(
      <SpotlightProvider>
        <SpotlightSearch defaultOpen={true} />
      </SpotlightProvider>
    );

    // Should still be 1 call (cached) - cache persists across mounts
    await waitFor(() => {
      expect(searchPublicUsers).toHaveBeenCalledTimes(1);
    });
  });

  it("clears cache when clearSearchCache is called", async () => {
    render(
      <SpotlightProvider>
        <SpotlightSearch defaultOpen={true} />
      </SpotlightProvider>
    );

    await waitFor(() => {
      expect(searchPublicUsers).toHaveBeenCalledTimes(1);
    });

    // Clear the cache
    clearSearchCache();

    // Clear mocks to reset call count
    vi.mocked(searchPublicUsers).mockClear();
    vi.mocked(getSearchableItems).mockClear();
    vi.mocked(searchPublicItems).mockClear();

    // Re-render with new mount - should fetch again since cache was cleared
    render(
      <SpotlightProvider>
        <SpotlightSearch defaultOpen={true} />
      </SpotlightProvider>
    );

    await waitFor(() => {
      expect(searchPublicUsers).toHaveBeenCalledTimes(1);
    });
  });
});

describe("SpotlightSearch - Independent Loading States", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    clearSearchCache();
  });

  it("shows section content as soon as that section loads", async () => {
    // Create deferred promises that we can resolve manually
    let resolveUsers: (value: { success: true; data: [] }) => void;
    let resolvePublicItems: (value: { success: true; data: [] }) => void;

    const usersPromise = new Promise<{ success: true; data: [] }>((resolve) => {
      resolveUsers = resolve;
    });
    const publicItemsPromise = new Promise<{ success: true; data: [] }>(
      (resolve) => {
        resolvePublicItems = resolve;
      }
    );

    // Items resolve immediately, others are pending
    vi.mocked(getSearchableItems).mockResolvedValue({
      success: true,
      data: [
        {
          id: "1",
          name: "My Item",
          description: null,
          artworkId: null,
          breadcrumb: null,
          parentId: null,
          depth: 0,
          ownerUsername: "testuser",
        },
      ],
    });
    vi.mocked(searchPublicUsers).mockReturnValue(usersPromise);
    vi.mocked(searchPublicItems).mockReturnValue(publicItemsPromise);

    render(
      <SpotlightProvider>
        <SpotlightSearch defaultOpen={true} />
      </SpotlightProvider>
    );

    // Items section should appear immediately even though users/public items are pending
    await waitFor(() => {
      expect(screen.getByText("Your Items")).toBeInTheDocument();
      expect(screen.getByText("My Item")).toBeInTheDocument();
    });

    // Resolve pending promises to avoid warnings about unhandled rejections
    resolveUsers!({ success: true, data: [] });
    resolvePublicItems!({ success: true, data: [] });
  });

  it("shows skeletons while section is loading", async () => {
    // Create a deferred promise for items
    let resolveItems: (value: {
      success: true;
      data: Array<{
        id: string;
        name: string;
        description: null;
        artworkId: null;
        breadcrumb: null;
        parentId: null;
        depth: number;
        ownerUsername: string | null;
      }>;
    }) => void;

    const itemsPromise = new Promise<{
      success: true;
      data: Array<{
        id: string;
        name: string;
        description: null;
        artworkId: null;
        breadcrumb: null;
        parentId: null;
        depth: number;
        ownerUsername: string | null;
      }>;
    }>((resolve) => {
      resolveItems = resolve;
    });

    vi.mocked(getSearchableItems).mockReturnValue(itemsPromise);
    vi.mocked(searchPublicUsers).mockResolvedValue({ success: true, data: [] });
    vi.mocked(searchPublicItems).mockResolvedValue({ success: true, data: [] });

    render(
      <SpotlightProvider>
        <SpotlightSearch defaultOpen={true} />
      </SpotlightProvider>
    );

    // Should show skeleton loaders while items are loading
    await waitFor(() => {
      // Check for skeleton elements (animated pulse divs)
      const skeletons = document.querySelectorAll(".animate-pulse");
      expect(skeletons.length).toBeGreaterThan(0);
    });

    // Resolve to allow test to complete cleanly
    resolveItems!({
      success: true,
      data: [
        {
          id: "1",
          name: "Item",
          description: null,
          artworkId: null,
          breadcrumb: null,
          parentId: null,
          depth: 0,
          ownerUsername: "testuser",
        },
      ],
    });

    // Wait for items to render
    await waitFor(() => {
      expect(screen.getByText("Item")).toBeInTheDocument();
    });
  });
});
