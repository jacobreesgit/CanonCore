/**
 * Unit tests for ConnectionCard component.
 */

import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { ConnectionCard } from "@/components/sftp/connection-card";

// Mock server action
vi.mock("@/lib/sftp-actions", () => ({
  deleteSftpConnection: vi.fn(),
}));

// Mock next/navigation
vi.mock("next/navigation", () => ({
  useRouter: () => ({
    push: vi.fn(),
    refresh: vi.fn(),
  }),
}));

describe("ConnectionCard", () => {
  const mockConnection = {
    id: "conn-123",
    name: "Test Server",
    host: "test.example.com",
    port: 22,
    username: "testuser",
    authType: "PASSWORD" as const,
    basePath: "/data",
    isActive: true,
    lastConnectedAt: new Date(),
    lastError: null,
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders connection details", () => {
    render(<ConnectionCard connection={mockConnection} />);

    expect(screen.getByText("Test Server")).toBeInTheDocument();
    expect(screen.getByText("test.example.com:22")).toBeInTheDocument();
    expect(screen.getByText("testuser")).toBeInTheDocument();
  });

  it("links to edit page when clicked", () => {
    render(<ConnectionCard connection={mockConnection} />);

    const link = screen.getByRole("link");
    expect(link).toHaveAttribute("href", "/my-items/connections/conn-123/edit");
  });

  it("does not show Edit in dropdown menu", async () => {
    const user = userEvent.setup({ pointerEventsCheck: 0 });
    render(<ConnectionCard connection={mockConnection} />);

    // Open dropdown
    const menuButton = screen.getByRole("button", {
      name: "Connection actions",
    });
    await user.click(menuButton);

    // Edit should not be present (card click handles edit now)
    expect(
      screen.queryByRole("menuitem", { name: /edit/i })
    ).not.toBeInTheDocument();

    // Delete should still be present
    expect(
      screen.getByRole("menuitem", { name: /delete/i })
    ).toBeInTheDocument();
  });

  it("shows error state when lastError is present", () => {
    const connectionWithError = {
      ...mockConnection,
      lastError: "Connection refused",
    };

    render(<ConnectionCard connection={connectionWithError} />);

    expect(screen.getByText("Connection refused")).toBeInTheDocument();
  });

  it("shows password auth type indicator", () => {
    render(<ConnectionCard connection={mockConnection} />);

    expect(screen.getByText("Password")).toBeInTheDocument();
  });

  it("shows SSH key auth type indicator", () => {
    const connectionWithKey = {
      ...mockConnection,
      authType: "PRIVATE_KEY" as const,
    };

    render(<ConnectionCard connection={connectionWithKey} />);

    expect(screen.getByText("SSH Key")).toBeInTheDocument();
  });
});
