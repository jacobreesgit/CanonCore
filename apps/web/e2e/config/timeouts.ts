/**
 * Centralized timeout constants for E2E tests.
 * Every timeout in POMs and tests MUST reference this object.
 */
export const Timeouts = {
  /** CSS transitions, sheet open/close, animation completion */
  animation: 1_000,
  /** Route changes, page loads (includes server data fetching), form submissions */
  navigation: 10_000,
  /** Server action responses, TMDB lookups, dialog interactions */
  api: 10_000,
  /** File uploads, Drive sync, large operations */
  upload: 15_000,
  /** Complex multi-step operations, bulk actions */
  heavy: 30_000,
} as const;
