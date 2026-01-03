/**
 * WebDAV URL and path utilities.
 * Handles URL construction and path security for streaming proxy.
 */

/**
 * Builds a complete WebDAV URL from base URL and path.
 * URL-encodes path segments for safe HTTP requests.
 *
 * @param baseUrl - WebDAV server base URL
 * @param path - File path on server
 * @returns Complete URL string
 */
export function buildWebDavUrl(baseUrl: string, path: string): string {
  // Remove trailing slash from base
  const base = baseUrl.replace(/\/+$/, "");

  // Ensure leading slash on path
  const cleanPath = path.startsWith("/") ? path : `/${path}`;

  // Split path into segments and encode each
  const segments = cleanPath.split("/").filter(Boolean);
  const encodedPath = segments.map((s) => encodeURIComponent(s)).join("/");

  return `${base}/${encodedPath}`;
}

/**
 * Sanitizes a path for WebDAV requests.
 * Removes path traversal attempts, null bytes, and normalizes slashes.
 *
 * @param path - Raw path input
 * @returns Sanitized path
 */
export function sanitizeWebDavPath(path: string): string {
  let sanitized = path;

  // Remove null bytes (intentional security measure)
  // eslint-disable-next-line no-control-regex
  sanitized = sanitized.replace(/\x00/g, "");

  // Normalize backslashes to forward slashes
  sanitized = sanitized.replace(/\\/g, "/");

  // Remove path traversal sequences
  sanitized = sanitized.replace(/\.\.+/g, "");

  // Normalize multiple slashes
  sanitized = sanitized.replace(/\/+/g, "/");

  // Ensure leading slash
  if (!sanitized.startsWith("/")) {
    sanitized = `/${sanitized}`;
  }

  // Remove trailing slash
  sanitized = sanitized.replace(/\/+$/, "");

  // If we end up with just "/" or empty, return "/"
  return sanitized || "/";
}

/** Maximum allowed path length to prevent DoS attacks */
const MAX_PATH_LENGTH = 4096;

/**
 * Validates that a path is safe for WebDAV requests.
 * Checks for security issues including path traversal, control characters,
 * and excessive length.
 *
 * @param path - Path to validate
 * @returns True if path is valid and safe
 */
export function isValidWebDavPath(path: string): boolean {
  if (!path || path.length === 0) return false;

  // Check for excessive length (DoS prevention)
  if (path.length > MAX_PATH_LENGTH) return false;

  // Check for null bytes
  if (path.includes("\x00")) return false;

  // Check for path traversal
  if (path.includes("..")) return false;

  // Check for control characters (ASCII 0-31 except tab, newline, carriage return)
  // eslint-disable-next-line no-control-regex
  if (/[\x00-\x08\x0B\x0C\x0E-\x1F]/.test(path)) return false;

  return true;
}
