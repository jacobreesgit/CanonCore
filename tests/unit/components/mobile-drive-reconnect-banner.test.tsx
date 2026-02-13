/**
 * Unit tests for the mobile Drive reconnect banner in MobileNavProvider.
 * Verifies banner rendering, accessibility, touch targets, and reconnect flow.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MobileNavProvider } from "@/components/mobile/mobile-nav-provider";

// Mock next/navigation
const mockPathname = vi.fn();
vi.mock("next/navigation", async (importOriginal) => {
  const actual = await importOriginal();
  return {
    ...(actual as object),
    usePathname: () => mockPathname(),
    useRouter: () => ({
      refresh: vi.fn(),
      push: vi.fn(),
    }),
  };
});

// Mock useIsMobile hook
const mockIsMobile = vi.fn();
vi.mock("@/hooks/use-mobile", () => ({
  useIsMobile: () => mockIsMobile(),
}));

// Mock next-themes
vi.mock("next-themes", () => ({
  useTheme: () => ({ theme: "dark", setTheme: vi.fn() }),
}));

// Mock useReducedMotion hook
vi.mock("@/hooks/use-reduced-motion", () => ({
  useReducedMotion: () => false,
  usePrefersReducedMotion: () => false,
}));

// Mock SpotlightSearch
vi.mock("@/components/search", () => ({
  SpotlightSearch: () => <div data-testid="spotlight-search">Search</div>,
}));

// Mock next-auth/react
vi.mock("next-auth/react", () => ({
  signOut: vi.fn(),
}));

// Mock MobileSettingsSheet
vi.mock("@/components/profile/mobile-settings-sheet", () => ({
  MobileSettingsSheet: ({ open }: { open: boolean }) =>
    open ? (
      <div data-testid="settings-sheet" role="dialog" aria-label="Settings">
        Settings
      </div>
    ) : null,
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
  mockPathname.mockReturnValue("/");
  mockIsMobile.mockReturnValue(true);
});

describe("Drive Reconnect Banner (Mobile)", () => {
  it("renders mobile banner when driveNeedsReauth is true", () => {
    render(
      <MobileNavProvider user={null} driveNeedsReauth={true}>
        <div>Content</div>
      </MobileNavProvider>
    );

    expect(
      screen.getByTestId("mobile-drive-reconnect-banner")
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /reconnect/i })
    ).toBeInTheDocument();
  });

  it("does NOT render mobile banner when driveNeedsReauth is false", () => {
    render(
      <MobileNavProvider user={null} driveNeedsReauth={false}>
        <div>Content</div>
      </MobileNavProvider>
    );

    expect(
      screen.queryByTestId("mobile-drive-reconnect-banner")
    ).not.toBeInTheDocument();
  });

  it("displays the correct warning message text", () => {
    render(
      <MobileNavProvider user={null} driveNeedsReauth={true}>
        <div>Content</div>
      </MobileNavProvider>
    );

    expect(
      screen.getByText(DRIVE_MESSAGES.DISCONNECTED_BANNER_SHORT)
    ).toBeInTheDocument();
  });

  it("calls initiateGoogleDriveOAuth on reconnect click", async () => {
    const user = userEvent.setup();
    vi.mocked(initiateGoogleDriveOAuth).mockResolvedValue({
      success: true,
      url: "https://accounts.google.com/o/oauth2/auth",
    });

    render(
      <MobileNavProvider user={null} driveNeedsReauth={true}>
        <div>Content</div>
      </MobileNavProvider>
    );

    await user.click(screen.getByRole("button", { name: /reconnect/i }));

    await waitFor(() => {
      expect(initiateGoogleDriveOAuth).toHaveBeenCalledTimes(1);
    });
  });

  it("shows error toast on OAuth failure", async () => {
    const user = userEvent.setup();
    vi.mocked(initiateGoogleDriveOAuth).mockResolvedValue({
      success: false,
      error: "OAuth failed",
    });

    render(
      <MobileNavProvider user={null} driveNeedsReauth={true}>
        <div>Content</div>
      </MobileNavProvider>
    );

    await user.click(screen.getByRole("button", { name: /reconnect/i }));

    await waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith("OAuth failed");
    });
  });

  it("has minimum 44px touch target on reconnect button", () => {
    render(
      <MobileNavProvider user={null} driveNeedsReauth={true}>
        <div>Content</div>
      </MobileNavProvider>
    );

    const button = screen.getByRole("button", { name: /reconnect/i });
    expect(button.className).toContain("min-h-[44px]");
  });

  it("has role='alert' and aria-live='assertive' attributes", () => {
    render(
      <MobileNavProvider user={null} driveNeedsReauth={true}>
        <div>Content</div>
      </MobileNavProvider>
    );

    const banner = screen.getByTestId("mobile-drive-reconnect-banner");
    expect(banner).toHaveAttribute("role", "alert");
    expect(banner).toHaveAttribute("aria-live", "assertive");
  });

  it("has lg:hidden class to hide on desktop", () => {
    render(
      <MobileNavProvider user={null} driveNeedsReauth={true}>
        <div>Content</div>
      </MobileNavProvider>
    );

    const banner = screen.getByTestId("mobile-drive-reconnect-banner");
    expect(banner.className).toContain("lg:hidden");
  });
});
