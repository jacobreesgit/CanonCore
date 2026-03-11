/**
 * Unit tests for useUsernameValidation hook.
 * Tests real-time username validation with format checks and availability API.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { renderHook, waitFor, act } from "@testing-library/react";
import { useUsernameValidation } from "@/hooks/use-username-validation";
import * as validations from "@/lib/validations";

// Mock validateUsername
vi.mock("@/lib/validations", () => ({
  validateUsername: vi.fn(),
}));

const mockValidateUsername = vi.mocked(validations.validateUsername);

// Mock fetch
const mockFetch = vi.fn();
global.fetch = mockFetch;

describe("useUsernameValidation", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockValidateUsername.mockReturnValue({ success: true });
    mockFetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ available: true }),
    });
  });

  afterEach(() => {
    vi.clearAllTimers();
  });

  describe("initial state", () => {
    it("returns initial state for empty username", () => {
      const { result } = renderHook(() => useUsernameValidation(""));

      expect(result.current).toEqual({
        isValidating: false,
        isValidFormat: false,
        isAvailable: null,
        error: null,
        success: null,
      });
    });

    it("returns initial state for whitespace-only username", () => {
      const { result } = renderHook(() => useUsernameValidation("   "));

      expect(result.current).toEqual({
        isValidating: false,
        isValidFormat: false,
        isAvailable: null,
        error: null,
        success: null,
      });
    });
  });

  describe("format validation", () => {
    it("shows error for invalid format immediately", () => {
      mockValidateUsername.mockReturnValue({
        success: false,
        error: "Username must be 3-20 characters",
      });

      const { result } = renderHook(() => useUsernameValidation("ab"));

      expect(result.current.isValidFormat).toBe(false);
      expect(result.current.error).toBe("Username must be 3-20 characters");
      expect(result.current.isValidating).toBe(false);
    });

    it("shows default error when validation returns no message", () => {
      mockValidateUsername.mockReturnValue({
        success: false,
        error: undefined,
      });

      const { result } = renderHook(() => useUsernameValidation("ab"));

      expect(result.current.error).toBe("Invalid username");
    });

    it("sets isValidFormat true for valid format", () => {
      mockValidateUsername.mockReturnValue({ success: true });

      const { result } = renderHook(() => useUsernameValidation("validuser"));

      expect(result.current.isValidFormat).toBe(true);
      expect(result.current.error).toBeNull();
    });

    it("normalizes username to lowercase for validation", () => {
      mockValidateUsername.mockReturnValue({ success: true });

      renderHook(() => useUsernameValidation("TestUser"));

      expect(mockValidateUsername).toHaveBeenCalledWith("testuser");
    });
  });

  describe("availability check", () => {
    beforeEach(() => {
      vi.useFakeTimers();
    });

    afterEach(() => {
      vi.useRealTimers();
    });

    it("does not call API before debounce delay", () => {
      mockValidateUsername.mockReturnValue({ success: true });

      renderHook(() => useUsernameValidation("testuser"));

      // Should not have made API call yet
      expect(mockFetch).not.toHaveBeenCalled();
    });

    it("calls API after 500ms debounce", async () => {
      mockValidateUsername.mockReturnValue({ success: true });

      renderHook(() => useUsernameValidation("testuser"));

      // Advance timers by 500ms
      act(() => {
        vi.advanceTimersByTime(500);
      });

      expect(mockFetch).toHaveBeenCalledTimes(1);
      expect(mockFetch).toHaveBeenCalledWith(
        "/api/username/check?username=testuser",
        expect.any(Object)
      );
    });

    it("cancels pending check on username change", async () => {
      mockValidateUsername.mockReturnValue({ success: true });

      const { rerender } = renderHook(
        ({ username }) => useUsernameValidation(username),
        { initialProps: { username: "test1" } }
      );

      // Advance partway through debounce
      act(() => {
        vi.advanceTimersByTime(300);
      });

      // Change username
      rerender({ username: "test2" });

      // Complete original debounce - should not call with old username
      act(() => {
        vi.advanceTimersByTime(200);
      });

      expect(mockFetch).not.toHaveBeenCalled();

      // Complete new debounce
      act(() => {
        vi.advanceTimersByTime(300);
      });

      expect(mockFetch).toHaveBeenCalledTimes(1);
      expect(mockFetch).toHaveBeenCalledWith(
        "/api/username/check?username=test2",
        expect.any(Object)
      );
    });

    it("encodes username in URL", async () => {
      mockValidateUsername.mockReturnValue({ success: true });

      renderHook(() => useUsernameValidation("test user"));

      act(() => {
        vi.advanceTimersByTime(500);
      });

      expect(mockFetch).toHaveBeenCalledWith(
        "/api/username/check?username=test%20user",
        expect.any(Object)
      );
    });
  });

  describe("API response handling", () => {
    it("shows success when username is available", async () => {
      mockValidateUsername.mockReturnValue({ success: true });
      mockFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ available: true }),
      });

      const { result } = renderHook(() => useUsernameValidation("available"));

      await waitFor(
        () => {
          expect(result.current.isAvailable).toBe(true);
        },
        { timeout: 2000 }
      );

      expect(result.current.success).toBe("Username is available");
      expect(result.current.error).toBeNull();
      expect(result.current.isValidating).toBe(false);
    });

    it("shows error when username is taken", async () => {
      mockValidateUsername.mockReturnValue({ success: true });
      mockFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ available: false }),
      });

      const { result } = renderHook(() => useUsernameValidation("taken"));

      await waitFor(
        () => {
          expect(result.current.isAvailable).toBe(false);
        },
        { timeout: 2000 }
      );

      expect(result.current.error).toBe("Username is already taken");
      expect(result.current.success).toBeNull();
    });

    it("handles API error gracefully", async () => {
      mockValidateUsername.mockReturnValue({ success: true });
      mockFetch.mockResolvedValue({
        ok: false,
        status: 500,
      });

      const { result } = renderHook(() => useUsernameValidation("testuser"));

      await waitFor(
        () => {
          expect(result.current.error).toBe(
            "Failed to check username availability"
          );
        },
        { timeout: 2000 }
      );

      expect(result.current.isAvailable).toBeNull();
      expect(result.current.isValidating).toBe(false);
    });

    it("handles fetch error gracefully", async () => {
      mockValidateUsername.mockReturnValue({ success: true });
      mockFetch.mockRejectedValue(new Error("Network error"));

      const { result } = renderHook(() => useUsernameValidation("testuser"));

      await waitFor(
        () => {
          expect(result.current.error).toBe(
            "Failed to check username availability"
          );
        },
        { timeout: 2000 }
      );

      expect(result.current.isAvailable).toBeNull();
    });
  });

  describe("current username handling", () => {
    beforeEach(() => {
      vi.useFakeTimers();
    });

    afterEach(() => {
      vi.useRealTimers();
    });

    it("skips availability check for current username", async () => {
      mockValidateUsername.mockReturnValue({ success: true });

      const { result } = renderHook(() =>
        useUsernameValidation("myusername", "myusername")
      );

      act(() => {
        vi.advanceTimersByTime(500);
      });

      expect(mockFetch).not.toHaveBeenCalled();
      expect(result.current.isAvailable).toBe(true);
      expect(result.current.success).toBe("Your current username");
    });

    it("handles case-insensitive current username match", async () => {
      mockValidateUsername.mockReturnValue({ success: true });

      const { result } = renderHook(() =>
        useUsernameValidation("MyUserName", "myusername")
      );

      act(() => {
        vi.advanceTimersByTime(500);
      });

      expect(mockFetch).not.toHaveBeenCalled();
      expect(result.current.isAvailable).toBe(true);
      expect(result.current.success).toBe("Your current username");
    });

    it("checks availability for different username", async () => {
      mockValidateUsername.mockReturnValue({ success: true });
      mockFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ available: true }),
      });

      renderHook(() => useUsernameValidation("newusername", "oldusername"));

      act(() => {
        vi.advanceTimersByTime(500);
      });

      expect(mockFetch).toHaveBeenCalled();
    });
  });

  describe("cleanup", () => {
    beforeEach(() => {
      vi.useFakeTimers();
    });

    afterEach(() => {
      vi.useRealTimers();
    });

    it("clears timeout on unmount", () => {
      mockValidateUsername.mockReturnValue({ success: true });
      const clearTimeoutSpy = vi.spyOn(global, "clearTimeout");

      const { unmount } = renderHook(() => useUsernameValidation("test"));

      unmount();

      expect(clearTimeoutSpy).toHaveBeenCalled();
      clearTimeoutSpy.mockRestore();
    });
  });

  describe("state transitions", () => {
    it("resets to initial state when username cleared", () => {
      mockValidateUsername.mockReturnValue({ success: true });

      const { result, rerender } = renderHook(
        ({ username }) => useUsernameValidation(username),
        { initialProps: { username: "testuser" } }
      );

      expect(result.current.isValidFormat).toBe(true);

      // Clear username
      rerender({ username: "" });

      expect(result.current).toEqual({
        isValidating: false,
        isValidFormat: false,
        isAvailable: null,
        error: null,
        success: null,
      });
    });

    it("sets isValidFormat before checking availability", () => {
      mockValidateUsername.mockReturnValue({ success: true });

      const { result } = renderHook(() => useUsernameValidation("newuser"));

      // After format validation, before API call
      expect(result.current.isValidFormat).toBe(true);
      expect(result.current.isAvailable).toBeNull();
      expect(result.current.isValidating).toBe(false);
    });
  });
});
