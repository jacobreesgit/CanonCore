/**
 * Utility functions for database seeding.
 * Handles file discovery and path mapping for SFTP uploads.
 */

import * as fs from "fs";
import * as path from "path";

/**
 * Recursively discovers all files in a directory.
 * Excludes .DS_Store and other system files (files starting with '.').
 *
 * @param dirPath - Directory path to scan
 * @returns Array of absolute file paths
 */
export function discoverSeedFiles(dirPath: string): string[] {
  const files: string[] = [];

  function walk(dir: string): void {
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        walk(fullPath);
      } else if (entry.isFile() && !entry.name.startsWith(".")) {
        files.push(fullPath);
      }
    }
  }

  walk(dirPath);
  return files;
}

/**
 * Maps a local file path to its remote SFTP path.
 *
 * @param localPath - Absolute local file path
 * @param basePath - Base directory path to make relative from
 * @returns Remote SFTP path with forward slashes
 * @throws Error if localPath is not within basePath
 */
export function mapLocalToRemotePath(
  localPath: string,
  basePath: string
): string {
  const relativePath = path.relative(basePath, localPath);

  // Validate that localPath is within basePath (no '..' escaping)
  if (relativePath.startsWith("..") || path.isAbsolute(relativePath)) {
    throw new Error(
      `Path "${localPath}" is not within base path "${basePath}"`
    );
  }

  return "/" + relativePath.split(path.sep).join("/");
}
