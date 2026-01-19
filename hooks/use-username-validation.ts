/**
 * Custom hook for real-time username validation with debounce.
 * Validates format locally and checks availability via API.
 */

import { useState, useEffect, useCallback, useRef } from "react";
import { validateUsername } from "@/lib/validations";
import type { UsernameCheckResult } from "@/lib/types";

/** Debounce delay in milliseconds for API availability checks. */
const DEBOUNCE_DELAY = 500;

/**
 * Validation state for username field.
 */
export interface UsernameValidationState {
  /** Whether validation is in progress */
  isValidating: boolean;
  /** Whether the username is valid format */
  isValidFormat: boolean;
  /** Whether the username is available (null if not yet checked) */
  isAvailable: boolean | null;
  /** Error message for invalid format or unavailable username */
  error: string | null;
  /** Success message when username is valid and available */
  success: string | null;
}

/**
 * Hook for real-time username validation.
 * Validates format locally (instant) and checks availability via API (debounced).
 *
 * @param username - Current username input value
 * @param currentUsername - User's existing username to skip availability check if unchanged
 * @returns Validation state object
 *
 * @example
 * ```tsx
 * function UsernameField() {
 *   const [username, setUsername] = useState("");
 *   const validation = useUsernameValidation(username);
 *
 *   return (
 *     <div>
 *       <input value={username} onChange={e => setUsername(e.target.value)} />
 *       {validation.isValidating && <span>Checking...</span>}
 *       {validation.error && <span className="text-red-500">{validation.error}</span>}
 *       {validation.success && <span className="text-green-500">{validation.success}</span>}
 *     </div>
 *   );
 * }
 * ```
 */
export function useUsernameValidation(
  username: string,
  currentUsername?: string | null
): UsernameValidationState {
  const [state, setState] = useState<UsernameValidationState>({
    isValidating: false,
    isValidFormat: false,
    isAvailable: null,
    error: null,
    success: null,
  });

  // Track latest username to avoid stale responses
  const latestUsernameRef = useRef(username);
  latestUsernameRef.current = username;

  // Abort controller for cancelling pending requests
  const abortControllerRef = useRef<AbortController | null>(null);

  const checkAvailability = useCallback(
    async (usernameToCheck: string) => {
      // Cancel any pending request
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }

      // Skip check if same as current username
      if (
        currentUsername &&
        usernameToCheck.toLowerCase() === currentUsername.toLowerCase()
      ) {
        setState((prev) => ({
          ...prev,
          isValidating: false,
          isAvailable: true,
          error: null,
          success: "Your current username",
        }));
        return;
      }

      // Create new abort controller
      abortControllerRef.current = new AbortController();

      setState((prev) => ({ ...prev, isValidating: true }));

      try {
        const response = await fetch(
          `/api/username/check?username=${encodeURIComponent(usernameToCheck)}`,
          { signal: abortControllerRef.current.signal }
        );

        // Ignore if username changed while fetching
        if (latestUsernameRef.current !== usernameToCheck) {
          return;
        }

        if (!response.ok) {
          throw new Error("Failed to check username availability");
        }

        const result: UsernameCheckResult = await response.json();

        setState((prev) => ({
          ...prev,
          isValidating: false,
          isAvailable: result.available,
          error: result.available ? null : "Username is already taken",
          success: result.available ? "Username is available" : null,
        }));
      } catch (error) {
        // Ignore abort errors
        if (error instanceof Error && error.name === "AbortError") {
          return;
        }

        // Ignore if username changed while fetching
        if (latestUsernameRef.current !== usernameToCheck) {
          return;
        }

        setState((prev) => ({
          ...prev,
          isValidating: false,
          isAvailable: null,
          error: "Failed to check username availability",
          success: null,
        }));
      }
    },
    [currentUsername]
  );

  useEffect(() => {
    // Reset state for empty username
    if (!username || username.trim() === "") {
      setState({
        isValidating: false,
        isValidFormat: false,
        isAvailable: null,
        error: null,
        success: null,
      });
      return;
    }

    // Normalize to lowercase for validation
    const normalizedUsername = username.toLowerCase();

    // Validate format locally (instant feedback)
    const formatResult = validateUsername(normalizedUsername);

    if (!formatResult.success) {
      setState({
        isValidating: false,
        isValidFormat: false,
        isAvailable: null,
        error: formatResult.error ?? "Invalid username",
        success: null,
      });
      return;
    }

    // Format is valid - update state and schedule availability check
    setState((prev) => ({
      ...prev,
      isValidFormat: true,
      isAvailable: null,
      error: null,
      success: null,
    }));

    // Debounce availability check
    const timeoutId = setTimeout(() => {
      checkAvailability(normalizedUsername);
    }, DEBOUNCE_DELAY);

    // Cleanup: cancel timeout and abort pending request on re-run or unmount
    return () => {
      clearTimeout(timeoutId);
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, [username, checkAvailability]);

  return state;
}
