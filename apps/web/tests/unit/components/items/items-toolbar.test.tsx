/**
 * Unit tests for ContentToolbar component.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ContentToolbar } from "@/components/ui/content-toolbar";
import type { ContentFilter } from "@/lib/types";

// Mock MobileOptionsSheet to simplify tests
vi.mock("@/components/items/mobile-options-sheet", () => ({
  MobileOptionsSheet: () => <div>Mobile Sheet</div>,
}));

describe("ContentToolbar", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("rendering", () => {
    it("should render without crashing with minimal props", () => {
      render(<ContentToolbar />);
      expect(document.body).toBeDefined();
    });

    it("should render sort and filter dropdowns when props provided", () => {
      render(
        <ContentToolbar
          sortBy="custom"
          onSortChange={() => {}}
          filters={[] as ContentFilter[]}
          toggleFilter={() => {}}
          clearFilters={() => {}}
        />
      );

      expect(screen.getByText("Custom Order")).toBeInTheDocument();
      expect(screen.getByText("Filter")).toBeInTheDocument();
    });

    it("should not render sort/filter when props omitted", () => {
      render(<ContentToolbar />);

      expect(screen.queryByText("Custom Order")).not.toBeInTheDocument();
      expect(screen.queryByText("Filter")).not.toBeInTheDocument();
    });

    it("should render actions slot content", () => {
      render(<ContentToolbar actions={<button>Custom</button>} />);

      expect(
        screen.getByRole("button", { name: "Custom" })
      ).toBeInTheDocument();
    });
  });

  describe("sync button", () => {
    it("should render sync buttons when showSync is true", () => {
      render(
        <ContentToolbar showSync hasDriveConnection={true} onSync={() => {}} />
      );

      // Mobile + desktop sync buttons both render (CSS hides one at a time)
      const syncButtons = screen.getAllByRole("button", { name: "Sync" });
      expect(syncButtons.length).toBeGreaterThanOrEqual(1);
    });

    it("should not render sync button when showSync is false", () => {
      render(<ContentToolbar />);

      expect(
        screen.queryByRole("button", { name: "Sync" })
      ).not.toBeInTheDocument();
    });

    it("should disable sync when no Drive connection", () => {
      render(
        <ContentToolbar showSync hasDriveConnection={false} onSync={() => {}} />
      );

      const syncButtons = screen.getAllByRole("button", { name: "Sync" });
      syncButtons.forEach((btn) => expect(btn).toBeDisabled());
    });

    it("should call onSync when sync button clicked", async () => {
      const onSync = vi.fn();
      const user = userEvent.setup();

      render(
        <ContentToolbar showSync hasDriveConnection={true} onSync={onSync} />
      );

      // Click the first sync button (mobile)
      const syncButtons = screen.getAllByRole("button", { name: "Sync" });
      await user.click(syncButtons[0]);
      expect(onSync).toHaveBeenCalledTimes(1);
    });

    it("should show syncing state", () => {
      render(
        <ContentToolbar
          showSync
          hasDriveConnection={true}
          isSyncing={true}
          onSync={() => {}}
        />
      );

      const syncButtons = screen.getAllByRole("button", { name: "Syncing" });
      syncButtons.forEach((btn) => expect(btn).toBeDisabled());
    });
  });

  describe("disabled state", () => {
    it("should disable sort dropdown when disabled is true", () => {
      render(
        <ContentToolbar
          sortBy="custom"
          onSortChange={() => {}}
          filters={[] as ContentFilter[]}
          toggleFilter={() => {}}
          clearFilters={() => {}}
          disabled
        />
      );

      expect(screen.getByText("Custom Order").closest("button")).toBeDisabled();
    });
  });
});
