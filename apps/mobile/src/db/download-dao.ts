import type { SQLiteDatabase } from "expo-sqlite";
import type { DownloadRecord, DownloadStatus } from "./schema";

/** Input for creating a new download record */
export interface CreateDownloadInput {
  fileId: string;
  itemId: string;
  filename: string;
  mimeType: string;
  itemName: string;
  posterUrl: string | null;
  totalBytes: number;
}

/**
 * Row shape returned by SQLite (snake_case columns).
 * Mapped to DownloadRecord (camelCase) by mapRow.
 */
interface DownloadRow {
  id: number;
  file_id: string;
  item_id: string;
  filename: string;
  mime_type: string;
  item_name: string;
  poster_url: string | null;
  bytes_downloaded: number;
  total_bytes: number;
  local_path: string | null;
  status: DownloadStatus;
  queue_order: number;
  created_at: string;
  updated_at: string;
  last_played_at: string | null;
}

function mapRow(row: DownloadRow): DownloadRecord {
  return {
    id: row.id,
    fileId: row.file_id,
    itemId: row.item_id,
    filename: row.filename,
    mimeType: row.mime_type,
    itemName: row.item_name,
    posterUrl: row.poster_url,
    bytesDownloaded: row.bytes_downloaded,
    totalBytes: row.total_bytes,
    localPath: row.local_path,
    status: row.status,
    queueOrder: row.queue_order,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    lastPlayedAt: row.last_played_at,
  };
}

export class DownloadDAO {
  constructor(private db: SQLiteDatabase) {}

  /** Get a download by fileId. Returns null if not found. */
  async getByFileId(fileId: string): Promise<DownloadRecord | null> {
    const row = await this.db.getFirstAsync<DownloadRow>(
      "SELECT * FROM downloads WHERE file_id = ?",
      [fileId]
    );
    return row ? mapRow(row) : null;
  }

  /** Get all downloads, ordered by status (active first) then by created_at desc. */
  async getAll(): Promise<DownloadRecord[]> {
    const rows = await this.db.getAllAsync<DownloadRow>(
      `SELECT * FROM downloads
       ORDER BY
         CASE status
           WHEN 'downloading' THEN 0
           WHEN 'queued' THEN 1
           WHEN 'failed' THEN 2
           WHEN 'complete' THEN 3
         END,
         queue_order ASC,
         created_at DESC`
    );
    return rows.map(mapRow);
  }

  /** Get all completed downloads ordered by last_played_at ASC (LRU first). */
  async getCompletedLRU(): Promise<DownloadRecord[]> {
    const rows = await this.db.getAllAsync<DownloadRow>(
      `SELECT * FROM downloads
       WHERE status = 'complete'
       ORDER BY CASE WHEN last_played_at IS NULL THEN 0 ELSE 1 END,
               last_played_at ASC, created_at ASC`
    );
    return rows.map(mapRow);
  }

  /** Get all downloads for a specific item. */
  async getByItemId(itemId: string): Promise<DownloadRecord[]> {
    const rows = await this.db.getAllAsync<DownloadRow>(
      "SELECT * FROM downloads WHERE item_id = ?",
      [itemId]
    );
    return rows.map(mapRow);
  }

  /** Get the next queued download (lowest queue_order). */
  async getNextQueued(): Promise<DownloadRecord | null> {
    const row = await this.db.getFirstAsync<DownloadRow>(
      "SELECT * FROM downloads WHERE status = 'queued' ORDER BY queue_order ASC LIMIT 1"
    );
    return row ? mapRow(row) : null;
  }

  /** Get total bytes of all completed downloads. */
  async getTotalDownloadedBytes(): Promise<number> {
    const result = await this.db.getFirstAsync<{ total: number }>(
      "SELECT COALESCE(SUM(total_bytes), 0) as total FROM downloads WHERE status = 'complete'"
    );
    return result?.total ?? 0;
  }

  /** Create a new download record. Returns the new record. */
  async create(input: CreateDownloadInput): Promise<DownloadRecord> {
    const maxOrder = await this.db.getFirstAsync<{
      max_order: number | null;
    }>(
      "SELECT MAX(queue_order) as max_order FROM downloads WHERE status IN ('queued', 'downloading')"
    );
    const nextOrder = (maxOrder?.max_order ?? -1) + 1;

    await this.db.runAsync(
      `INSERT INTO downloads (file_id, item_id, filename, mime_type, item_name, poster_url, total_bytes, queue_order)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        input.fileId,
        input.itemId,
        input.filename,
        input.mimeType,
        input.itemName,
        input.posterUrl ?? null,
        input.totalBytes,
        nextOrder,
      ]
    );

    const record = await this.getByFileId(input.fileId);
    if (!record) throw new Error("Failed to create download record");
    return record;
  }

  /** Update download progress (bytes downloaded). */
  async updateProgress(
    fileId: string,
    bytesDownloaded: number,
    totalBytes?: number
  ): Promise<void> {
    const updates =
      totalBytes !== undefined
        ? "bytes_downloaded = ?, total_bytes = ?, updated_at = datetime('now')"
        : "bytes_downloaded = ?, updated_at = datetime('now')";
    const params =
      totalBytes !== undefined
        ? [bytesDownloaded, totalBytes, fileId]
        : [bytesDownloaded, fileId];

    await this.db.runAsync(
      `UPDATE downloads SET ${updates} WHERE file_id = ?`,
      params
    );
  }

  /** Update download status. */
  async updateStatus(
    fileId: string,
    status: DownloadStatus
  ): Promise<void> {
    await this.db.runAsync(
      "UPDATE downloads SET status = ?, updated_at = datetime('now') WHERE file_id = ?",
      [status, fileId]
    );
  }

  /** Mark download as complete with local file path. */
  async markComplete(fileId: string, localPath: string): Promise<void> {
    await this.db.runAsync(
      `UPDATE downloads
       SET status = 'complete', local_path = ?, updated_at = datetime('now')
       WHERE file_id = ?`,
      [localPath, fileId]
    );
  }

  /** Update last_played_at timestamp (for LRU tracking). */
  async touchLastPlayed(fileId: string): Promise<void> {
    await this.db.runAsync(
      "UPDATE downloads SET last_played_at = datetime('now') WHERE file_id = ?",
      [fileId]
    );
  }

  /** Delete a download record by fileId. */
  async delete(fileId: string): Promise<void> {
    await this.db.runAsync("DELETE FROM downloads WHERE file_id = ?", [
      fileId,
    ]);
  }

  /** Delete all download records. */
  async deleteAll(): Promise<void> {
    await this.db.runAsync("DELETE FROM downloads");
  }

  /** Check if a file is downloaded and complete. */
  async isDownloaded(fileId: string): Promise<boolean> {
    const row = await this.db.getFirstAsync<{ count: number }>(
      "SELECT COUNT(*) as count FROM downloads WHERE file_id = ? AND status = 'complete'",
      [fileId]
    );
    return (row?.count ?? 0) > 0;
  }

  /** Reset interrupted downloads ("downloading") back to "queued". */
  async resetInterrupted(): Promise<void> {
    await this.db.runAsync(
      "UPDATE downloads SET status = 'queued', updated_at = datetime('now') WHERE status = 'downloading'"
    );
  }

  /** Get count of queued + downloading items. */
  async getActiveCount(): Promise<number> {
    const row = await this.db.getFirstAsync<{ count: number }>(
      "SELECT COUNT(*) as count FROM downloads WHERE status IN ('queued', 'downloading')"
    );
    return row?.count ?? 0;
  }
}
