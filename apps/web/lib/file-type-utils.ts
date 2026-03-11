/**
 * File type detection utilities.
 * Categorizes files by extension for media library organization.
 */

import { FileType } from "@prisma/client";

/** Video and audio file extensions */
export const MEDIA_EXTENSIONS = [
  ".mp4",
  ".mkv",
  ".avi",
  ".m4v",
  ".webm",
  ".mov",
  ".mp3",
  ".m4a",
  ".flac",
  ".wav",
  ".ogg",
] as const;

/** Image file extensions for artwork */
export const ARTWORK_EXTENSIONS = [
  ".jpg",
  ".jpeg",
  ".png",
  ".webp",
  ".gif",
] as const;

/** Subtitle file extensions */
export const SUBTITLE_EXTENSIONS = [".srt", ".vtt", ".sub", ".ass"] as const;

// Sets for O(1) lookups (js-set-map-lookups)
const MEDIA_EXTENSIONS_SET = new Set<string>(MEDIA_EXTENSIONS);
const ARTWORK_EXTENSIONS_SET = new Set<string>(ARTWORK_EXTENSIONS);
const SUBTITLE_EXTENSIONS_SET = new Set<string>(SUBTITLE_EXTENSIONS);
const SUBTITLE_BARE_SET = new Set(["srt", "vtt", "sub", "ass"]);

/** Extension to MIME type mapping */
const MIME_TYPES: Record<string, string> = {
  // Video
  ".mp4": "video/mp4",
  ".mkv": "video/x-matroska",
  ".avi": "video/x-msvideo",
  ".m4v": "video/x-m4v",
  ".webm": "video/webm",
  ".mov": "video/quicktime",
  // Audio
  ".mp3": "audio/mpeg",
  ".m4a": "audio/mp4",
  ".flac": "audio/flac",
  ".wav": "audio/wav",
  ".ogg": "audio/ogg",
  // Images
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".png": "image/png",
  ".webp": "image/webp",
  ".gif": "image/gif",
  // Subtitles
  ".srt": "text/plain",
  ".vtt": "text/vtt",
  ".sub": "text/plain",
  ".ass": "text/plain",
};

/**
 * Gets the file extension from a filename.
 *
 * @param filename - File name or path
 * @returns Lowercase extension with dot, or empty string
 */
function getExtension(filename: string): string {
  const lastDot = filename.lastIndexOf(".");
  if (lastDot === -1) return "";
  return filename.slice(lastDot).toLowerCase();
}

/**
 * Determines the FileType based on file extension.
 *
 * @param filename - File name or path
 * @returns FileType enum value or null if unknown
 */
export function getFileTypeByExtension(filename: string): FileType | null {
  const ext = getExtension(filename);
  if (!ext) return null;

  if (MEDIA_EXTENSIONS_SET.has(ext)) {
    return "MEDIA";
  }
  if (ARTWORK_EXTENSIONS_SET.has(ext)) {
    return "ARTWORK";
  }
  if (SUBTITLE_EXTENSIONS_SET.has(ext)) {
    return "SUBTITLE";
  }

  return null;
}

/**
 * Gets the MIME type for a file based on extension.
 *
 * @param filename - File name or path
 * @returns MIME type string or null if unknown
 */
export function getMimeTypeByExtension(filename: string): string | null {
  const ext = getExtension(filename);
  return MIME_TYPES[ext] ?? null;
}

/**
 * Categorizes a file type based on MIME type and filename.
 * Used for Google Drive sync operations.
 *
 * @param mimeType - The MIME type
 * @param filename - The filename
 * @returns The categorized file type (defaults to MEDIA if unknown)
 */
export function categorizeFileType(
  mimeType: string,
  filename: string
): FileType {
  if (mimeType.startsWith("video/") || mimeType.startsWith("audio/")) {
    return "MEDIA";
  }
  if (mimeType.startsWith("image/")) {
    return "ARTWORK";
  }
  const ext = filename.split(".").pop()?.toLowerCase();
  if (ext && SUBTITLE_BARE_SET.has(ext)) {
    return "SUBTITLE";
  }
  return "MEDIA";
}
