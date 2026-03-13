const API_URL = process.env.EXPO_PUBLIC_API_URL ?? "http://localhost:3000";

/**
 * Build artwork image URL for an item's primary file.
 * Maps to web app's /api/artwork/[fileId] route.
 */
export function getArtworkUrl(fileId: string): string {
  return `${API_URL}/api/artwork/${fileId}`;
}

/**
 * Build stream URL for media playback.
 * Maps to web app's /api/stream/[fileId] route.
 */
export function getStreamUrl(fileId: string): string {
  return `${API_URL}/api/stream/${fileId}`;
}

/**
 * Build user avatar URL (authenticated, current user only).
 * Maps to web app's /api/user/avatar route.
 */
export function getAvatarUrl(): string {
  return `${API_URL}/api/user/avatar`;
}

/**
 * Build user hero image URL (authenticated, current user only).
 * Maps to web app's /api/user/hero route.
 */
export function getHeroUrl(): string {
  return `${API_URL}/api/user/hero`;
}

/**
 * Build public user avatar URL (for other users' profiles).
 * Requires /api/public/avatar/[userId] route (created in Plan 7).
 */
export function getPublicAvatarUrl(userId: string): string {
  return `${API_URL}/api/public/avatar/${userId}`;
}

/**
 * Build public user hero image URL (for other users' profiles).
 * Requires /api/public/hero/[userId] route (created in Plan 7).
 */
export function getPublicHeroUrl(userId: string): string {
  return `${API_URL}/api/public/hero/${userId}`;
}

/**
 * Build playlist artwork URL.
 * Maps to web app's /api/playlist/artwork route.
 */
export function getPlaylistArtworkUrl(playlistId: string): string {
  return `${API_URL}/api/playlist/artwork?id=${playlistId}`;
}

/**
 * Build TMDB poster URL from a poster path.
 */
export function getTmdbPosterUrl(
  posterPath: string,
  size: "w185" | "w342" | "w500" | "w780" = "w342"
): string {
  return `https://image.tmdb.org/t/p/${size}${posterPath}`;
}

/**
 * Build TMDB backdrop URL from a backdrop path.
 */
export function getTmdbBackdropUrl(
  backdropPath: string,
  size: "w780" | "w1280" | "original" = "w780"
): string {
  return `https://image.tmdb.org/t/p/${size}${backdropPath}`;
}
