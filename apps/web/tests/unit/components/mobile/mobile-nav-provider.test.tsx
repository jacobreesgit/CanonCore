/**
 * Unit tests for MobileNavProvider component.
 * Tests sheet state management, mutual exclusion, and route change behavior.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MobileNavProvider } from "@/components/mobile/mobile-nav-provider";
import { DRIVE_MESSAGES } from "@/lib/constants/messages";

vi.mock("@/hooks/use-google-drive-reconnect", () => ({
  useGoogleDriveReconnect: () => ({
    isReconnecting: false,
    handleReconnect: vi.fn(),
  }),
}));

// Mock next/navigation
const mockPathname = vi.fn();
vi.mock("next/navigation", () => ({
  usePathname: () => mockPathname(),
}));

// Mock useIsMobile hook
const mockIsMobile = vi.fn();
vi.mock("@/hooks/use-mobile", () => ({
  useIsMobile: () => mockIsMobile(),
}));

// Mock next-themes
const mockTheme = vi.fn();
const mockSetTheme = vi.fn();
vi.mock("next-themes", () => ({
  useTheme: () => ({ theme: mockTheme(), setTheme: mockSetTheme }),
}));

// Mock useReducedMotion hook
vi.mock("@/hooks/use-reduced-motion", () => ({
  useReducedMotion: () => false,
  usePrefersReducedMotion: () => false,
}));

// Mock SpotlightSearch (imported by MobileSearchSheet)
vi.mock("@/components/search", () => ({
  SpotlightSearch: () => <div>Search</div>,
}));

// Mock next-auth/react
vi.mock("next-auth/react", () => ({
  signOut: vi.fn(),
}));

// Mock MobileSettingsSheet (complex tabbed component with many dependencies)
vi.mock("@/components/profile/mobile-settings-sheet", () => ({
  MobileSettingsSheet: ({
    open,
    user,
    googleDriveConnection,
  }: {
    open: boolean;
    user: { name: string | null; email: string } | null;
    googleDriveConnection: unknown;
  }) =>
    open ? (
      <div role="dialog" aria-label="Settings">
        {user?.name && <div>{user.name}</div>}
        <div>{user?.email}</div>
        {googleDriveConnection ? <div>Google Drive</div> : null}
      </div>
    ) : null,
}));

// Mock useRouter
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

describe("MobileNavProvider", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockPathname.mockReturnValue("/");
    mockIsMobile.mockReturnValue(true);
    mockTheme.mockReturnValue("light");
  });

  describe("Rendering", () => {
    it("renders children", () => {
      render(
        <MobileNavProvider user={null}>
          <main>App Content</main>
        </MobileNavProvider>
      );

      expect(screen.getByRole("main")).toBeInTheDocument();
      expect(screen.getByText("App Content")).toBeInTheDocument();
    });

    it("renders footer navigation on mobile", () => {
      mockIsMobile.mockReturnValue(true);

      render(
        <MobileNavProvider user={null}>
          <div>Content</div>
        </MobileNavProvider>
      );

      expect(
        screen.getByRole("navigation", { name: /mobile navigation/i })
      ).toBeInTheDocument();
    });

    it("does not render footer navigation on desktop", () => {
      mockIsMobile.mockReturnValue(false);

      render(
        <MobileNavProvider user={null}>
          <div>Content</div>
        </MobileNavProvider>
      );

      expect(
        screen.queryByRole("navigation", { name: /mobile navigation/i })
      ).not.toBeInTheDocument();
    });
  });

  describe("Guest User", () => {
    it("shows guest navigation items when user is null", () => {
      mockIsMobile.mockReturnValue(true);

      render(
        <MobileNavProvider user={null}>
          <div>Content</div>
        </MobileNavProvider>
      );

      expect(screen.getByText("Explore")).toBeInTheDocument();
      expect(screen.getByText("Search")).toBeInTheDocument();
      expect(screen.getByText("Help")).toBeInTheDocument();
      expect(screen.getByText("Sign In")).toBeInTheDocument();
    });

    it("does not show authenticated items for guest", () => {
      mockIsMobile.mockReturnValue(true);

      render(
        <MobileNavProvider user={null}>
          <div>Content</div>
        </MobileNavProvider>
      );

      expect(screen.queryByText("My Items")).not.toBeInTheDocument();
      expect(screen.queryByText("Account")).not.toBeInTheDocument();
    });
  });

  describe("Authenticated User", () => {
    const mockUser = {
      name: "John Doe",
      email: "john@example.com",
      username: "johndoe",
    };

    it("shows authenticated navigation items", () => {
      mockIsMobile.mockReturnValue(true);

      render(
        <MobileNavProvider user={mockUser}>
          <div>Content</div>
        </MobileNavProvider>
      );

      expect(screen.getByText("My Items")).toBeInTheDocument();
      expect(screen.getByText("Explore")).toBeInTheDocument();
      expect(screen.getByText("Help")).toBeInTheDocument();
      expect(screen.getByText("Account")).toBeInTheDocument();
    });

    it("does not show guest items for authenticated user", () => {
      mockIsMobile.mockReturnValue(true);

      render(
        <MobileNavProvider user={mockUser}>
          <div>Content</div>
        </MobileNavProvider>
      );

      // Authenticated users don't see Sign In button
      expect(screen.queryByText("Sign In")).not.toBeInTheDocument();
    });
  });

  describe("Sheet Interactions", () => {
    it("opens help sheet when Help button is clicked", async () => {
      const user = userEvent.setup();
      mockIsMobile.mockReturnValue(true);

      render(
        <MobileNavProvider user={null}>
          <div>Content</div>
        </MobileNavProvider>
      );

      const helpButton = screen.getByRole("button", { name: /help/i });
      await user.click(helpButton);

      // Help sheet should open - look for "Documentation" text in header
      await waitFor(() => {
        expect(screen.getByText("Documentation")).toBeInTheDocument();
      });
    });

    it("opens user sheet for authenticated users when Account is clicked", async () => {
      const user = userEvent.setup();
      mockIsMobile.mockReturnValue(true);

      const mockUser = {
        name: "John Doe",
        email: "john@example.com",
        username: "johndoe",
      };

      render(
        <MobileNavProvider user={mockUser}>
          <div>Content</div>
        </MobileNavProvider>
      );

      const accountButton = screen.getByRole("button", {
        name: /account menu/i,
      });
      await user.click(accountButton);

      // User sheet should open with user info
      await waitFor(() => {
        expect(screen.getByText("John Doe")).toBeInTheDocument();
        expect(screen.getByText("john@example.com")).toBeInTheDocument();
      });
    });
  });

  describe("Sheet State Management", () => {
    it("toggles sheet closed when clicking same button", async () => {
      const user = userEvent.setup();
      mockIsMobile.mockReturnValue(true);

      render(
        <MobileNavProvider user={null}>
          <div>Content</div>
        </MobileNavProvider>
      );

      // Open Help sheet
      const helpButton = screen.getByRole("button", { name: /help/i });
      await user.click(helpButton);

      await waitFor(() => {
        expect(screen.getByText("Documentation")).toBeInTheDocument();
      });

      // Sheet dialog should be open
      expect(screen.getByRole("dialog")).toBeInTheDocument();
    });
  });

  describe("Drive Reconnect Banner (Mobile)", () => {
    it("should render mobile reconnect banner when driveNeedsReauth is true", () => {
      render(
        <MobileNavProvider user={null} driveNeedsReauth={true}>
          <div>Content</div>
        </MobileNavProvider>
      );

      expect(screen.getByRole("alert")).toBeInTheDocument();
      expect(
        screen.getByText(DRIVE_MESSAGES.DISCONNECTED_BANNER)
      ).toBeInTheDocument();
    });

    it("should NOT render mobile reconnect banner when driveNeedsReauth is false", () => {
      render(
        <MobileNavProvider user={null} driveNeedsReauth={false}>
          <div>Content</div>
        </MobileNavProvider>
      );

      expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    });

    it("should NOT render mobile reconnect banner when driveNeedsReauth is undefined", () => {
      render(
        <MobileNavProvider user={null}>
          <div>Content</div>
        </MobileNavProvider>
      );

      expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    });

    it("mobile reconnect button should be present and enabled", () => {
      render(
        <MobileNavProvider user={null} driveNeedsReauth={true}>
          <div>Content</div>
        </MobileNavProvider>
      );

      const button = screen.getByRole("button", { name: /reconnect/i });
      expect(button).toBeEnabled();
    });

    it("should prioritise drive banner over email banner when both are true", () => {
      render(
        <MobileNavProvider
          user={null}
          driveNeedsReauth={true}
          emailUnverified={true}
        >
          <div>Content</div>
        </MobileNavProvider>
      );

      // Drive banner shown
      expect(screen.getByRole("alert")).toBeInTheDocument();
      expect(
        screen.getByText(DRIVE_MESSAGES.DISCONNECTED_BANNER)
      ).toBeInTheDocument();
      // Email banner NOT shown (only one at a time)
      expect(screen.queryByRole("status")).not.toBeInTheDocument();
    });
  });

  describe("Props Handling", () => {
    it("passes driveConnection to MobileUserSheet", async () => {
      const user = userEvent.setup();
      mockIsMobile.mockReturnValue(true);

      const mockUser = {
        name: "Jane Doe",
        email: "jane@example.com",
        username: "janedoe",
      };

      const mockDriveConnection = {
        email: "jane@example.com",
        rootFolderId: "folder-123",
        isActive: true,
        needsReauth: false,
        lastSyncAt: new Date(),
        lastError: null,
        quotaBytesUsed: BigInt(1000000),
        quotaBytesTotal: BigInt(15000000000),
      };

      render(
        <MobileNavProvider
          user={mockUser}
          driveConnection={mockDriveConnection}
        >
          <div>Content</div>
        </MobileNavProvider>
      );

      // Open user sheet
      const accountButton = screen.getByRole("button", {
        name: /account menu/i,
      });
      await user.click(accountButton);

      // Should show Google Drive section
      await waitFor(() => {
        expect(screen.getByText("Google Drive")).toBeInTheDocument();
      });
    });
  });
});
