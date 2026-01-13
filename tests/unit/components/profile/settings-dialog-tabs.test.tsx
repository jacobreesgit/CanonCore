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
  getPreferences: vi.fn().mockResolvedValue({
    success: true,
    data: { viewMode: "grid", sortBy: "custom" },
  }),
  updatePreferences: vi.fn().mockResolvedValue({ success: true }),
}));

const mockUser = {
  name: "Test User",
  email: "test@example.com",
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

    // Should have Profile and Preferences tabs
    expect(screen.getByRole("tab", { name: /profile/i })).toBeInTheDocument();
    expect(
      screen.getByRole("tab", { name: /preferences/i })
    ).toBeInTheDocument();
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

  it("switches to Preferences tab when clicked", async () => {
    const user = userEvent.setup();
    render(
      <SettingsDialog
        open={true}
        onOpenChange={() => {}}
        user={mockUser}
        googleDriveConnection={null}
      />
    );

    // Click Preferences tab
    await user.click(screen.getByRole("tab", { name: /preferences/i }));

    // Preferences tab should now be active
    await waitFor(() => {
      const prefsTab = screen.getByRole("tab", { name: /preferences/i });
      expect(prefsTab).toHaveAttribute("data-state", "active");
    });

    // Preferences content should be visible
    await waitFor(() => {
      expect(screen.getByText("View Mode")).toBeInTheDocument();
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

    // Switch to Preferences tab
    await user.click(screen.getByRole("tab", { name: /preferences/i }));

    await waitFor(() => {
      expect(screen.getByText("View Mode")).toBeInTheDocument();
    });

    // Switch back to Profile
    await user.click(screen.getByRole("tab", { name: /profile/i }));

    await waitFor(() => {
      expect(screen.getByText("Display Name")).toBeInTheDocument();
    });
  });
});
