import { render, screen, fireEvent } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import { ViewerItemContextMenu } from "@/components/items/viewer-item-context-menu";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn() }),
}));

describe("ViewerItemContextMenu", () => {
  it("shows Add to Playlist when showAddToPlaylist is true", () => {
    render(
      <ViewerItemContextMenu
        itemId="item-1"
        itemName="Test Item"
        showAddToPlaylist
      >
        <div>Trigger</div>
      </ViewerItemContextMenu>
    );
    fireEvent.contextMenu(screen.getByText("Trigger"));
    expect(screen.getByText("Add to Playlist")).toBeInTheDocument();
  });

  it("shows Fork to Library when onFork is provided", () => {
    render(
      <ViewerItemContextMenu
        itemId="item-1"
        itemName="Test Item"
        onFork={() => {}}
      >
        <div>Trigger</div>
      </ViewerItemContextMenu>
    );
    fireEvent.contextMenu(screen.getByText("Trigger"));
    expect(screen.getByText("Fork to Library")).toBeInTheDocument();
  });

  it("shows Sign in to Fork when isGuest is true", () => {
    render(
      <ViewerItemContextMenu itemId="item-1" itemName="Test Item" isGuest>
        <div>Trigger</div>
      </ViewerItemContextMenu>
    );
    fireEvent.contextMenu(screen.getByText("Trigger"));
    expect(screen.getByText("Sign in to Fork")).toBeInTheDocument();
  });

  it("shows Already in Library as non-interactive status when isForked", () => {
    render(
      <ViewerItemContextMenu
        itemId="item-1"
        itemName="Test Item"
        isForked
        showAddToPlaylist
      >
        <div>Trigger</div>
      </ViewerItemContextMenu>
    );
    fireEvent.contextMenu(screen.getByText("Trigger"));
    expect(screen.queryByText("Fork to Library")).not.toBeInTheDocument();
    const status = screen.getByText("In Your Library");
    expect(status).toBeInTheDocument();
    expect(status.closest("[role='menuitem']")).toBeNull();
  });
});
