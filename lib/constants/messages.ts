/**
 * Centralised error and success messages for consistency across the platform.
 *
 * Guidelines:
 * - No trailing periods on toast messages (toasts have visual termination)
 * - Use sentence case for messages
 * - Keep messages concise and actionable
 */

/** Sync status messages for Google Drive integration. */
export const SYNC_MESSAGES = {
  ROOT_FOLDER_TRASHED:
    "Sync paused: CanonCore folder is in Trash. Restore it in Google Drive or reconnect",
  ROOT_FOLDER_DELETED:
    "Sync paused: CanonCore folder was deleted. Reconnect in settings",
  SYNC_FAILED: "Sync failed",
  SYNC_COMPLETE: (message: string) => `Sync complete: ${message}`,
} as const;

/** Settings dialog messages. */
export const SETTINGS_MESSAGES = {
  SAVED: "Settings saved",
  PASSWORD_SAVED: "Password saved",
  EMAIL_SAVED: "Email saved",
  USERNAME_SAVED: "Username saved",
} as const;

/** Item action messages. */
export const ITEM_MESSAGES = {
  PINNED: "Pinned to sidebar",
  UNPINNED: "Unpinned from sidebar",
  DELETED: "Deleted successfully",
  DELETED_COUNT: (count: number) =>
    `Deleted ${count} item${count === 1 ? "" : "s"}`,
  METADATA_APPLIED: "Metadata applied successfully",
  METADATA_FAILED: "Failed to apply metadata",
} as const;

/** Google Drive connection messages. */
export const DRIVE_MESSAGES = {
  DISCONNECTED_BANNER:
    "Google Drive disconnected. Syncing and streaming are paused until you reconnect",
  DISCONNECTED_BANNER_SHORT: "Drive disconnected",
} as const;

/** TMDB wizard error and status messages. */
export const TMDB_WIZARD_MESSAGES = {
  SEASON_LOAD_ERROR: "Failed to load season details. Please try again",
  IMAGES_UNAVAILABLE: "Artwork not available for this selection",
  NO_STILLS: "No still images available for this episode",
  NETWORK_SLOW: "Connection is slow. Please wait or try again",
  RATE_LIMITED: (seconds: number) =>
    `Too many requests. Please wait ${seconds} second${seconds === 1 ? "" : "s"}`,
} as const;
