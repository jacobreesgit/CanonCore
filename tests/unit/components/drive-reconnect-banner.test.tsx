/**
 * Unit tests for the desktop Drive reconnect banner in SiteHeader.
 * Verifies banner rendering, accessibility, and reconnect flow.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { SiteHeader } from "@/components/site-header";

// Mock next/navigation
vi.mock("next/navigation", () => ({
  useRouter: vi.fn(() => ({
    push: vi.fn(),
    replace: vi.fn(),
    refresh: vi.fn(),
    back: vi.fn(),
    forward: vi.fn(),
    prefetch: vi.fn(),
  })),
  usePathname: vi.fn(() => "/"),
  useSearchParams: vi.fn(() => new URLSearchParams()),
}));

// Mock sidebar components (avoids SidebarProvider context requirement)
vi.mock("@/components/ui/sidebar", () => ({
  SidebarTrigger: (props: Record<string, unknown>) => (
    <button {...props}>Toggle Sidebar</button>
  ),
}));

// Mock Google Drive OAuth action
vi.mock("@/lib/google-drive-actions", () => ({
  initiateGoogleDriveOAuth: vi.fn(),
}));

// Mock sonner toast
vi.mock("sonner", () => ({
  toast: {
    error: vi.fn(),
    success: vi.fn(),
  },
}));

import { initiateGoogleDriveOAuth } from "@/lib/google-drive-actions";
import { toast } from "sonner";
import { DRIVE_MESSAGES } from "@/lib/constants/messages";

beforeEach(() => {
  vi.clearAllMocks();
});

describe("Drive Reconnect Banner (Desktop)", () => {
  it("renders banner when driveNeedsReauth is true", () => {
    render(<SiteHeader driveNeedsReauth={true} />);

    expect(screen.getByTestId("drive-reconnect-banner")).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /reconnect/i })
    ).toBeInTheDocument();
  });

  it("does NOT render banner when driveNeedsReauth is false", () => {
    render(<SiteHeader driveNeedsReauth={false} />);

    expect(
      screen.queryByTestId("drive-reconnect-banner")
    ).not.toBeInTheDocument();
  });

  it("does NOT render banner when driveNeedsReauth is undefined", () => {
    render(<SiteHeader />);

    expect(
      screen.queryByTestId("drive-reconnect-banner")
    ).not.toBeInTheDocument();
  });

  it("displays the correct warning message text", () => {
    render(<SiteHeader driveNeedsReauth={true} />);

    expect(
      screen.getByText(DRIVE_MESSAGES.DISCONNECTED_BANNER)
    ).toBeInTheDocument();
  });

  it("calls initiateGoogleDriveOAuth on reconnect click", async () => {
    const user = userEvent.setup();
    vi.mocked(initiateGoogleDriveOAuth).mockResolvedValue({
      success: true,
      url: "https://accounts.google.com/o/oauth2/auth",
    });

    render(<SiteHeader driveNeedsReauth={true} />);
    await user.click(screen.getByRole("button", { name: /reconnect/i }));

    await waitFor(() => {
      expect(initiateGoogleDriveOAuth).toHaveBeenCalledTimes(1);
    });
  });

  it("shows loading state during OAuth initiation", async () => {
    const user = userEvent.setup();
    // Never-resolving promise to keep loading state visible
    vi.mocked(initiateGoogleDriveOAuth).mockReturnValue(new Promise(() => {}));

    render(<SiteHeader driveNeedsReauth={true} />);
    await user.click(screen.getByRole("button", { name: /reconnect/i }));

    await waitFor(() => {
      expect(
        screen.getByRole("button", { name: /connecting/i })
      ).toBeInTheDocument();
      expect(
        screen.getByRole("button", { name: /connecting/i })
      ).toBeDisabled();
    });
  });

  it("shows error toast on OAuth failure", async () => {
    const user = userEvent.setup();
    vi.mocked(initiateGoogleDriveOAuth).mockResolvedValue({
      success: false,
      error: "OAuth failed",
    });

    render(<SiteHeader driveNeedsReauth={true} />);
    await user.click(screen.getByRole("button", { name: /reconnect/i }));

    await waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith("OAuth failed");
    });
  });

  it("has role='alert' and aria-live='assertive' attributes", () => {
    render(<SiteHeader driveNeedsReauth={true} />);

    const banner = screen.getByTestId("drive-reconnect-banner");
    expect(banner).toHaveAttribute("role", "alert");
    expect(banner).toHaveAttribute("aria-live", "assertive");
  });
});
