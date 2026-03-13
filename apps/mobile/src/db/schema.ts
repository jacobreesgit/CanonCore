import type { SQLiteDatabase } from "expo-sqlite";

/**
 * Download status lifecycle:
 * queued → downloading → complete
 *                     → failed (retryable)
 * Any status → removed (user deleted or LRU eviction)
 */
export type DownloadStatus = "queued" | "downloading" | "complete" | "failed";

export interface DownloadRecord {
  id: number;
  fileId: string;
  itemId: string;
  filename: string;
  mimeType: string;
  itemName: string;
  posterUrl: string | null;
  /** Bytes downloaded so far */
  bytesDownloaded: number;
  /** Total file size in bytes (0 if unknown) */
  totalBytes: number;
  /** Local filesystem path (set on completion) */
  localPath: string | null;
  status: DownloadStatus;
  /** Queue ordering — lower = higher priority */
  queueOrder: number;
  /** ISO timestamp */
  createdAt: string;
  /** ISO timestamp of last status update */
  updatedAt: string;
  /** ISO timestamp of last playback (for LRU eviction) */
  lastPlayedAt: string | null;
}

/**
 * Run migrations on database init.
 * Called by SQLiteProvider's onInit callback.
 * Uses user_version pragma for versioning.
 */
export async function migrateDatabase(db: SQLiteDatabase): Promise<void> {
  const result = await db.getFirstAsync<{ user_version: number }>(
    "PRAGMA user_version"
  );
  const currentVersion = result?.user_version ?? 0;

  if (currentVersion < 1) {
    await db.execAsync(`
      CREATE TABLE IF NOT EXISTS downloads (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        file_id TEXT NOT NULL UNIQUE,
        item_id TEXT NOT NULL,
        filename TEXT NOT NULL,
        mime_type TEXT NOT NULL,
        item_name TEXT NOT NULL,
        poster_url TEXT,
        bytes_downloaded INTEGER NOT NULL DEFAULT 0,
        total_bytes INTEGER NOT NULL DEFAULT 0,
        local_path TEXT,
        status TEXT NOT NULL DEFAULT 'queued',
        queue_order INTEGER NOT NULL DEFAULT 0,
        created_at TEXT NOT NULL DEFAULT (datetime('now')),
        updated_at TEXT NOT NULL DEFAULT (datetime('now')),
        last_played_at TEXT
      );

      CREATE INDEX IF NOT EXISTS idx_downloads_status ON downloads(status);
      CREATE INDEX IF NOT EXISTS idx_downloads_item_id ON downloads(item_id);
      CREATE INDEX IF NOT EXISTS idx_downloads_queue_order ON downloads(queue_order);

      PRAGMA user_version = 1;
    `);
  }
}
