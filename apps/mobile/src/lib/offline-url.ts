import { getStreamUrl } from "@/lib/image-url";
import type { DownloadManager } from "@/services/download-manager";

/**
 * Get the playback URL for a media file.
 * If the file is downloaded, returns the local file URI.
 * Otherwise, falls back to the remote stream URL.
 */
export async function getOfflineAwareStreamUrl(
  fileId: string,
  downloadManager: DownloadManager | null
): Promise<string> {
  if (downloadManager) {
    const localPath = await downloadManager.getLocalPath(fileId);
    if (localPath) {
      return localPath;
    }
  }

  return getStreamUrl(fileId);
}
