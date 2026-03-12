/**
 * Unit tests for the email verification nudge banner in SiteHeader.
 * Verifies banner rendering, accessibility, and resend flow.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { SiteHeader } from "@/components/site-header";

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

vi.mock("@/components/ui/sidebar", () => ({
  SidebarTrigger: (props: Record<string, unknown>) => (
    <button {...props}>Toggle Sidebar</button>
  ),
}));

vi.mock("@/lib/auth-actions", () => ({
  resendVerificationEmail: vi.fn(),
}));

vi.mock("sonner", () => ({
  toast: {
    error: vi.fn(),
    success: vi.fn(),
  },
}));

import { resendVerificationEmail } from "@/lib/auth-actions";
import { toast } from "sonner";

beforeEach(() => {
  vi.clearAllMocks();
});

describe("Email Verification Banner (Desktop)", () => {
  it("renders banner when emailUnverified is true", () => {
    render(<SiteHeader emailUnverified={true} />);

    expect(screen.getByRole("status")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /resend/i })).toBeInTheDocument();
  });

  it("does NOT render banner when emailUnverified is false", () => {
    render(<SiteHeader emailUnverified={false} />);

    expect(screen.queryByRole("status")).not.toBeInTheDocument();
  });

  it("does NOT render banner when emailUnverified is undefined", () => {
    render(<SiteHeader />);

    expect(screen.queryByRole("status")).not.toBeInTheDocument();
  });

  it("calls resendVerificationEmail on resend click", async () => {
    const user = userEvent.setup();
    vi.mocked(resendVerificationEmail).mockResolvedValue({ success: true });

    render(<SiteHeader emailUnverified={true} />);
    await user.click(screen.getByRole("button", { name: /resend/i }));

    await waitFor(() => {
      expect(resendVerificationEmail).toHaveBeenCalledWith();
    });
  });

  it("shows success toast on successful resend", async () => {
    const user = userEvent.setup();
    vi.mocked(resendVerificationEmail).mockResolvedValue({ success: true });

    render(<SiteHeader emailUnverified={true} />);
    await user.click(screen.getByRole("button", { name: /resend/i }));

    await waitFor(() => {
      expect(toast.success).toHaveBeenCalledWith("Verification email sent");
    });
  });

  it("has role='status' and aria-live='polite' attributes", () => {
    render(<SiteHeader emailUnverified={true} />);

    const banner = screen.getByRole("status");
    expect(banner).toHaveAttribute("aria-live", "polite");
  });
});
