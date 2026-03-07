/**
 * Types for the Redux media playback system.
 */

/** A single track in the playback queue. */
export interface QueueTrack {
  /** ItemFile ID (used for streaming URL: /api/stream/{fileId}) */
  fileId: string;
  /** Parent Item ID (for navigation back to item detail) */
  itemId: string;
  /** Display filename (e.g. "Breaking Bad S01E01.mkv") */
  filename: string;
  /** MIME type for the Audio/Video element */
  mimeType: string;
  /** Item name for display (e.g. "Breaking Bad") */
  itemName: string;
  /** Poster/artwork URL for mini-player thumbnail */
  posterUrl?: string;
  /** Known duration in seconds (from playbackDuration field) */
  duration?: number;
  /** Saved playback position for resume (from playbackPosition field) */
  playbackPosition?: number;
}

/** Repeat mode for queue playback. */
export type RepeatMode = "off" | "one" | "all";

/** Full playback state shape. */
export interface PlaybackState {
  /** Currently playing track, or null if nothing loaded */
  currentTrack: QueueTrack | null;
  /** Ordered queue of upcoming tracks */
  queue: QueueTrack[];
  /** Index of current track within queue (-1 if playing outside queue) */
  queueIndex: number;
  /** Whether audio/video is currently playing */
  isPlaying: boolean;
  /** Current playback time in seconds */
  currentTime: number;
  /** Total duration in seconds (updated by audio element) */
  duration: number;
  /** Volume level 0-1 */
  volume: number;
  /** Whether audio is muted */
  isMuted: boolean;
  /** Shuffle mode */
  shuffle: boolean;
  /** Repeat mode */
  repeat: RepeatMode;
  /** Whether the expanded (fullscreen) player view is open */
  isExpanded: boolean;
  /** Target time in seconds when user initiates a seek, null otherwise */
  seekTarget: number | null;
}

/** UI preferences state shape. */
export interface UiPrefsState {
  /** Default sidebar collapsed state */
  sidebarCollapsed: boolean;
  /** Default view mode for items pages */
  defaultViewMode: "grid" | "tree";
}
