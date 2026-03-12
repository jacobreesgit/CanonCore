/**
 * Avatar utility functions for generating consistent initials and gradient backgrounds.
 * Used by hero components and profile displays.
 */

/**
 * Generates a gradient background based on a string (username/id).
 * Creates consistent colors for the same user.
 *
 * @param seed - String to generate gradient from (e.g., user ID)
 * @returns CSS linear-gradient string
 */
export function getInitialsGradient(seed: string): string {
  let hash = 0;
  for (let i = 0; i < seed.length; i++) {
    hash = seed.charCodeAt(i) + ((hash << 5) - hash);
  }
  const hue = Math.abs(hash) % 360;
  return `linear-gradient(135deg, hsl(${hue}, 70%, 45%) 0%, hsl(${(hue + 40) % 360}, 80%, 35%) 100%)`;
}

/**
 * Gets the initials from a name or username.
 *
 * @param name - Display name (nullable)
 * @param username - Username fallback
 * @returns One or two character initials string
 */
export function getInitials(name: string | null, username: string): string {
  const trimmed = name?.trim();
  if (trimmed) {
    const parts = trimmed.split(/\s+/).filter(Boolean);
    if (parts.length >= 2) {
      return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase();
    }
    return trimmed[0].toUpperCase();
  }
  if (username) {
    return username[0].toUpperCase();
  }
  return "?";
}
