/**
 * Unit tests for Settings dialog tabs functionality.
 */

import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { SettingsDialog } from "@/components/profile/settings-dialog";

// Mock server actions
vi.mock("@/lib/user-actions", () => ({
  updateProfile: vi.fn().mockResolvedValue({ success: true }),
  uploadProfileImage: vi.fn().mockResolvedValue({ success: true }),
  uploadHeroImage: vi.fn().mockResolvedValue({ success: true }),
  removeProfileImage: vi.fn().mockResolvedValue({ success: true }),
  removeHeroImage: vi.fn().mockResolvedValue({ success: true }),
  changePassword: vi.fn().mockResolvedValue({ success: true }),
}));

const mockUser = {
  name: "Test User",
  email: "test@example.com",
  username: null,
  isPublic: false,
  hasImage: false,
  hasHeroImage: false,
};

describe("SettingsDialog Tabs", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders with tabs in main view", async () => {
    render(
      <SettingsDialog
        open={true}
        onOpenChange={() => {}}
        user={mockUser}
        googleDriveConnection={null}
      />
    );

    // Should have Profile, Account, Connections, and Activity tabs
    expect(screen.getByRole("tab", { name: /profile/i })).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: /account/i })).toBeInTheDocument();
    expect(
      screen.getByRole("tab", { name: /connections/i })
    ).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: /activity/i })).toBeInTheDocument();
  });

  it("shows Profile tab content by default", async () => {
    render(
      <SettingsDialog
        open={true}
        onOpenChange={() => {}}
        user={mockUser}
        googleDriveConnection={null}
      />
    );

    // Profile tab should be selected by default
    const profileTab = screen.getByRole("tab", { name: /profile/i });
    expect(profileTab).toHaveAttribute("data-state", "active");

    // Profile content should be visible
    expect(screen.getByText("Display Name")).toBeInTheDocument();
  });

  it("switches to Account tab when clicked", async () => {
    const user = userEvent.setup();
    render(
      <SettingsDialog
        open={true}
        onOpenChange={() => {}}
        user={mockUser}
        googleDriveConnection={null}
      />
    );

    // Click Account tab
    await user.click(screen.getByRole("tab", { name: /account/i }));

    // Account tab should now be active
    await waitFor(() => {
      const accountTab = screen.getByRole("tab", { name: /account/i });
      expect(accountTab).toHaveAttribute("data-state", "active");
    });
  });

  it("maintains tab state within dialog session", async () => {
    const user = userEvent.setup();
    render(
      <SettingsDialog
        open={true}
        onOpenChange={() => {}}
        user={mockUser}
        googleDriveConnection={null}
      />
    );

    // Switch to Account tab
    await user.click(screen.getByRole("tab", { name: /account/i }));

    await waitFor(() => {
      const accountTab = screen.getByRole("tab", { name: /account/i });
      expect(accountTab).toHaveAttribute("data-state", "active");
    });

    // Switch back to Profile
    await user.click(screen.getByRole("tab", { name: /profile/i }));

    await waitFor(() => {
      expect(screen.getByText("Display Name")).toBeInTheDocument();
    });
  });
});
