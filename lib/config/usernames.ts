/**
 * Username configuration constants.
 * Centralized config for username validation rules and reserved names.
 */

/**
 * Reserved usernames that cannot be registered.
 * Includes system routes, admin-related terms, and common brand/legal terms.
 *
 * To add a new reserved username, add it to the appropriate category below.
 * All checks are case-insensitive.
 */
export const RESERVED_USERNAMES = new Set([
  // System routes - match Next.js app routes
  "admin",
  "api",
  "auth",
  "settings",
  "profile",
  "user",
  "users",
  "account",
  "login",
  "logout",
  "signup",
  "signin",
  "register",
  "explore",
  "search",
  "help",
  "support",
  "docs",
  "documentation",

  // Admin/moderation terms
  "moderator",
  "mod",
  "administrator",
  "staff",
  "team",
  "official",
  "verified",

  // Brand protection
  "canoncore",
  "canon",
  "core",

  // Legal/compliance terms
  "copyright",
  "dmca",
  "legal",
  "terms",
  "privacy",
  "security",

  // Common reserved/system names
  "root",
  "system",
  "null",
  "undefined",
  "anonymous",
  "guest",
  "test",
  "demo",
  "www",
  "mail",
  "email",
  "ftp",
  "blog",
  "news",
  "info",
]);

/**
 * Checks if a username is in the reserved list.
 *
 * @param username - Username to check (case-insensitive)
 * @returns True if the username is reserved
 */
export function isUsernameReserved(username: string): boolean {
  return RESERVED_USERNAMES.has(username.toLowerCase());
}
