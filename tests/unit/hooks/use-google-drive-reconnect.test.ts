/**
 * Unit tests for useGoogleDriveReconnect hook.
 * Tests OAuth initiation, redirect, and error handling.
 */

import { renderHook, act } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock useTransition to execute the callback synchronously
vi.mock("react", async () => {
  const actual = await vi.importActual("react");
  return {
    ...actual,
    useTransition: () => [false, (fn: () => void) => fn()],
  };
});

vi.mock("@/lib/google-drive-actions", () => ({
  initiateGoogleDriveOAuth: vi.fn(),
}));

vi.mock("sonner", () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}));

import { useGoogleDriveReconnect } from "@/hooks/use-google-drive-reconnect";
import { initiateGoogleDriveOAuth } from "@/lib/google-drive-actions";
import { toast } from "sonner";

const mockInitiateOAuth = vi.mocked(initiateGoogleDriveOAuth);

// Mock window.location
const originalLocation = window.location;

beforeEach(() => {
  vi.clearAllMocks();
  Object.defineProperty(window, "location", {
    writable: true,
    value: { ...originalLocation, href: "" },
  });
});

describe("useGoogleDriveReconnect", () => {
  it("returns isReconnecting and handleReconnect", () => {
    const { result } = renderHook(() => useGoogleDriveReconnect());

    expect(result.current).toHaveProperty("isReconnecting");
    expect(result.current).toHaveProperty("handleReconnect");
    expect(typeof result.current.handleReconnect).toBe("function");
  });

  it("redirects to OAuth URL on success", async () => {
    mockInitiateOAuth.mockResolvedValue({
      success: true,
      url: "https://accounts.google.com/o/oauth2/auth?client_id=123",
    });

    const { result } = renderHook(() => useGoogleDriveReconnect());

    await act(async () => {
      result.current.handleReconnect();
    });

    expect(mockInitiateOAuth).toHaveBeenCalled();
    expect(window.location.href).toBe(
      "https://accounts.google.com/o/oauth2/auth?client_id=123"
    );
    expect(toast.error).not.toHaveBeenCalled();
  });

  it("shows error toast on failure", async () => {
    mockInitiateOAuth.mockResolvedValue({
      success: false,
      error: "OAuth configuration missing",
    });

    const { result } = renderHook(() => useGoogleDriveReconnect());

    await act(async () => {
      result.current.handleReconnect();
    });

    expect(toast.error).toHaveBeenCalledWith("OAuth configuration missing");
    expect(window.location.href).toBe("");
  });

  it("shows default error message when no error provided", async () => {
    mockInitiateOAuth.mockResolvedValue({
      success: false,
    });

    const { result } = renderHook(() => useGoogleDriveReconnect());

    await act(async () => {
      result.current.handleReconnect();
    });

    expect(toast.error).toHaveBeenCalledWith("Failed to start reconnection");
  });

  it("does not redirect when success is true but url is missing", async () => {
    mockInitiateOAuth.mockResolvedValue({
      success: true,
    });

    const { result } = renderHook(() => useGoogleDriveReconnect());

    await act(async () => {
      result.current.handleReconnect();
    });

    expect(window.location.href).toBe("");
    expect(toast.error).toHaveBeenCalledWith("Failed to start reconnection");
  });
});
