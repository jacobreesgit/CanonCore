/**
 * Unit tests for ItemDetailClient component.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, act } from "@testing-library/react";
import { Provider } from "react-redux";
import { configureStore } from "@reduxjs/toolkit";
import playbackReducer from "@/lib/store/playback-slice";
import uiPrefsReducer from "@/lib/store/ui-prefs-slice";
import { ItemDetailClient } from "@/components/items/item-detail-client";

function makeTestStore() {
  return configureStore({
    reducer: { playback: playbackReducer, uiPrefs: uiPrefsReducer },
  });
}

function renderWithStore(ui: React.ReactElement) {
  return render(<Provider store={makeTestStore()}>{ui}</Provider>);
}

// Mock next/navigation
const mockRefresh = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: mockRefresh }),
}));

// Mock server actions
vi.mock("@/lib/item-actions", () => ({
  getItems: vi.fn().mockResolvedValue({ success: true, data: [] }),
  updateItem: vi.fn().mockResolvedValue({ success: true }),
  deleteItem: vi.fn().mockResolvedValue({ success: true }),
  createItem: vi
    .fn()
    .mockResolvedValue({ success: true, data: { id: "new-1" } }),
}));

vi.mock("@/lib/item-file-actions", () => ({
  getItemFiles: vi.fn().mockResolvedValue({
    success: true,
    data: { media: [], artwork: [], subtitles: [] },
  }),
  updatePlaybackPosition: vi.fn().mockResolvedValue({ success: true }),
}));

// Mock child components to simplify tests
vi.mock("@/components/ui/content-toolbar", () => ({
  ContentToolbar: ({
    disabled,
    actions,
  }: {
    disabled?: boolean;
    actions?: React.ReactNode;
  }) => (
    <div aria-label="content toolbar" data-disabled={disabled}>
      {actions && <div aria-label="toolbar actions">{actions}</div>}
    </div>
  ),
  ToolbarDivider: () => <div />,
}));

vi.mock("@/components/items/items-view", () => ({
  ItemsView: ({
    items,
    parentId,
    isEditing,
  }: {
    items: Array<{ id: string }>;
    parentId: string;
    isEditing: boolean;
  }) => (
    <div
      aria-label="items view"
      data-parent-id={parentId}
      data-editing={isEditing}
    >
      {items.length} items
    </div>
  ),
}));

vi.mock("@/components/hero", () => ({
  CinematicHero: ({
    slides,
    actions,
  }: {
    slides: Array<{ id: string; name: string }>;
    actions?: React.ReactNode;
  }) => {
    const slide = slides[0];
    return (
      <div aria-label="hero carousel" data-name={slide?.name}>
        {slide?.name} hero
        {actions && <div aria-label="hero actions">{actions}</div>}
      </div>
    );
  },
}));

vi.mock("@/components/media/media-overlay", () => ({
  MediaOverlay: () => <div aria-label="media overlay">Media overlay</div>,
}));

// Mock useItemsUrlState (uses nuqs which requires adapter in tests)
vi.mock("@/hooks/use-items-url-state", () => ({
  useItemsUrlState: () => ({
    sortBy: "custom",
    setSortBy: vi.fn(),
    filters: [],
    toggleFilter: vi.fn(),
    clearFilters: vi.fn(),
    hasActiveFilters: false,
    viewMode: "grid",
    setViewMode: vi.fn(),
    tab: null,
    setTab: vi.fn(),
    isCustomSort: true,
  }),
}));

// Mock sonner toast
vi.mock("sonner", () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
  },
}));

// Mock DetailSettingsMenu
vi.mock("@/components/items/detail-settings-menu", () => ({
  DetailSettingsMenu: (props: { itemName: string }) => (
    <button aria-label="detail-settings-button">
      {props.itemName} Settings
    </button>
  ),
}));

describe("ItemDetailClient", () => {
  const defaultItem = {
    id: "item-1",
    name: "Movies",
    description: "My movie collection",
    driveConnectionId: null,
    driveFileId: null,
    isPublic: false,
    inheritVisibility: false,
    parentId: null,
    childCount: 0,
    tmdbId: null,
    tmdbType: null,
    tmdbPosterPath: null,
    tmdbBackdropPath: null,
    tmdbLogoPath: null,
    tmdbShowTagline: true,
    tmdbShowMetadata: true,
    tmdbShowGenres: true,
    tmdbShowCast: true,
    tmdbShowProviders: true,
    tmdbShowVideos: true,
    tmdbShowRecommendations: true,
  };

  const defaultChildItems = [
    {
      id: "child-1",
      name: "Action",
      description: null,
      parentId: "item-1",
      order: 0,
      depth: 1,
      pinnedOrder: null,
      isPublic: false,
      inheritVisibility: false,
      userId: "user-1",
      createdAt: new Date(),
      updatedAt: new Date(),
      // TMDB metadata
      tmdbId: null,
      tmdbType: null,
      tmdbPosterPath: null,
      tmdbBackdropPath: null,
      tmdbLogoPath: null,
      dominantColour: null,
      tmdbShowTagline: true,
      tmdbShowMetadata: true,
      tmdbShowGenres: true,
      tmdbShowCast: true,
      tmdbShowProviders: true,
      tmdbShowVideos: true,
      tmdbShowRecommendations: true,
      // Google Drive fields
      driveFileId: null,
      driveModifiedAt: null,
      driveThumbnailUrl: null,
      syncStatus: "SYNCED" as const,
      syncError: null,
      driveConnectionId: null,
      artworkId: null,
      fileCounts: { media: 0, artwork: 0, subtitles: 0 },
      childCount: 0,
      primaryMediaName: null,
      mediaIconType: null,
      progress: null,
    },
  ];

  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  /**
   * Helper to wait for loading state to complete.
   * Component shows spinner for 300ms min duration + hydration.
   */
  async function waitForLoading() {
    await act(async () => {
      vi.advanceTimersByTime(350);
    });
  }

  describe("rendering", () => {
    it("should render hero, toolbar, and items view", async () => {
      renderWithStore(<ItemDetailClient item={defaultItem} childItems={[]} />);
      await waitForLoading();

      expect(screen.getByLabelText("hero carousel")).toBeInTheDocument();
      expect(screen.getByLabelText("content toolbar")).toBeInTheDocument();
      expect(screen.getByLabelText("items view")).toBeInTheDocument();
    });

    it("should always render hero regardless of files/children", async () => {
      renderWithStore(<ItemDetailClient item={defaultItem} childItems={[]} />);
      await waitForLoading();
      expect(screen.getByLabelText("hero carousel")).toBeInTheDocument();
    });

    it("should pass item name to hero", async () => {
      renderWithStore(<ItemDetailClient item={defaultItem} childItems={[]} />);
      await waitForLoading();
      expect(screen.getByLabelText("hero carousel")).toHaveAttribute(
        "data-name",
        "Movies"
      );
    });

    it("should pass childItems to items view", async () => {
      renderWithStore(
        <ItemDetailClient item={defaultItem} childItems={defaultChildItems} />
      );
      await waitForLoading();

      expect(screen.getByLabelText("items view")).toHaveTextContent("1 items");
    });

    it("should disable toolbar when no children", async () => {
      renderWithStore(<ItemDetailClient item={defaultItem} childItems={[]} />);
      await waitForLoading();

      expect(screen.getByLabelText("content toolbar")).toHaveAttribute(
        "data-disabled",
        "true"
      );
    });

    it("should render DetailSettingsMenu in hero actions", async () => {
      renderWithStore(<ItemDetailClient item={defaultItem} childItems={[]} />);
      await waitForLoading();
      expect(
        screen.getByLabelText("detail-settings-button")
      ).toBeInTheDocument();
    });
  });

  describe("hero with files", () => {
    const filesWithMedia = {
      media: [
        {
          id: "file-1",
          itemId: "item-1",
          filename: "movie.mp4",
          driveFileId: "drive-file-123",
          fileType: "MEDIA" as const,
          mimeType: "video/mp4",
          size: 1024000,
          syncStatus: "SYNCED" as const,
          syncError: null,
          isPrimary: true,
          isHero: false,
          isLogo: false,
          playbackPosition: null,
          playbackDuration: null,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ],
      artwork: [],
      subtitles: [],
    };

    it("should render Play button in hero when media files exist", async () => {
      renderWithStore(
        <ItemDetailClient
          item={defaultItem}
          childItems={[]}
          files={filesWithMedia}
        />
      );
      await waitForLoading();

      expect(screen.getByLabelText("hero actions")).toBeInTheDocument();
      expect(screen.getByText("Play")).toBeInTheDocument();
    });

    it("should show hero without file cards (MediaOverlay only when playing)", async () => {
      renderWithStore(
        <ItemDetailClient
          item={defaultItem}
          childItems={[]}
          files={filesWithMedia}
        />
      );
      await waitForLoading();

      expect(screen.getByLabelText("hero carousel")).toBeInTheDocument();
      // No file cards - MediaOverlay only appears when playing
      expect(screen.queryByLabelText("media overlay")).not.toBeInTheDocument();
    });

    it("should show Contents/About tabs when children exist", async () => {
      renderWithStore(
        <ItemDetailClient
          item={defaultItem}
          childItems={defaultChildItems}
          files={filesWithMedia}
        />
      );
      await waitForLoading();

      // Tabs appear when there are children or TMDB data
      expect(screen.getByRole("tablist")).toBeInTheDocument();
    });
  });

  describe("Google Drive connection state", () => {
    it("should detect Drive connected when both driveConnectionId and driveFileId exist", async () => {
      const driveItem = {
        ...defaultItem,
        driveConnectionId: "drive-conn-1",
        driveFileId: "drive-file-456",
      };

      renderWithStore(<ItemDetailClient item={driveItem} childItems={[]} />);
      await waitForLoading();

      // Component should render without error
      expect(screen.getByLabelText("content toolbar")).toBeInTheDocument();
    });
  });

  describe("render order", () => {
    it("should render toolbar after hero", async () => {
      renderWithStore(<ItemDetailClient item={defaultItem} childItems={[]} />);
      await waitForLoading();

      const toolbar = screen.getByLabelText("content toolbar");
      const hero = screen.getByLabelText("hero carousel");

      // Toolbar should come after hero in DOM order
      expect(toolbar.compareDocumentPosition(hero)).toBe(
        Node.DOCUMENT_POSITION_PRECEDING
      );
    });
  });
});
