import { View, Text, Pressable } from "@/tw";
import { FontAwesomeIcon } from "@fortawesome/react-native-fontawesome";
import {
  faFileVideo,
  faFileAudio,
  faFileImage,
  faClosedCaptioning,
  faCircleCheck,
} from "@fortawesome/free-solid-svg-icons";
import { formatDuration } from "@canoncore/utils/media";
import { DownloadButton } from "@/components/downloads/download-button";

interface FileItem {
  id: string;
  filename: string;
  fileType: "MEDIA" | "ARTWORK" | "SUBTITLE";
  mimeType: string | null;
  size: number | null;
  isPrimary: boolean;
  isHero: boolean;
  durationMs: number | null;
  width: number | null;
  height: number | null;
}

interface FilesListProps {
  files: FileItem[];
  onFilePress?: (file: FileItem) => void;
  /** Item context for download buttons */
  itemId?: string;
  itemName?: string;
  posterUrl?: string | null;
}

function getFileIcon(file: FileItem) {
  if (file.fileType === "ARTWORK") return faFileImage;
  if (file.fileType === "SUBTITLE") return faClosedCaptioning;
  if (file.mimeType?.startsWith("audio/")) return faFileAudio;
  return faFileVideo;
}

function formatFileSize(bytes: number | null): string {
  if (bytes == null) return "";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024)
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(1)} GB`;
}

export function FilesList({ files, onFilePress, itemId, itemName, posterUrl }: FilesListProps) {
  const mediaFiles = files.filter((f) => f.fileType === "MEDIA");
  const artworkFiles = files.filter((f) => f.fileType === "ARTWORK");
  const subtitleFiles = files.filter((f) => f.fileType === "SUBTITLE");

  const renderFile = (file: FileItem) => (
    <Pressable
      key={file.id}
      onPress={() => onFilePress?.(file)}
      className="flex-row items-center gap-3 px-4 py-3 active:bg-white/5"
    >
      <FontAwesomeIcon
        icon={getFileIcon(file)}
        size={16}
        color="rgba(255, 255, 255, 0.5)"
      />
      <View className="flex-1 gap-0.5">
        <Text className="text-foreground text-sm" numberOfLines={1}>
          {file.filename}
        </Text>
        <View className="flex-row gap-2">
          {file.durationMs ? (
            <Text className="text-muted-foreground text-xs">
              {formatDuration(file.durationMs)}
            </Text>
          ) : null}
          {file.width && file.height ? (
            <Text className="text-muted-foreground text-xs">
              {file.width}×{file.height}
            </Text>
          ) : null}
          {file.size ? (
            <Text className="text-muted-foreground text-xs">
              {formatFileSize(file.size)}
            </Text>
          ) : null}
        </View>
      </View>
      {file.fileType === "MEDIA" && itemId && itemName ? (
        <DownloadButton
          fileId={file.id}
          downloadInput={{
            fileId: file.id,
            itemId: itemId,
            filename: file.filename,
            mimeType: file.mimeType ?? "application/octet-stream",
            itemName: itemName,
            posterUrl: posterUrl ?? null,
            totalBytes: file.size ?? 0,
          }}
          variant="compact"
        />
      ) : null}
      {file.isPrimary ? (
        <FontAwesomeIcon icon={faCircleCheck} size={14} color="#22c55e" />
      ) : null}
    </Pressable>
  );

  const renderSection = (title: string, sectionFiles: FileItem[]) => {
    if (sectionFiles.length === 0) return null;
    return (
      <View className="gap-1">
        <Text className="text-muted-foreground text-xs font-semibold uppercase tracking-wider px-4 py-2">
          {title} ({sectionFiles.length})
        </Text>
        {sectionFiles.map(renderFile)}
      </View>
    );
  };

  if (files.length === 0) {
    return (
      <View className="items-center justify-center py-16 px-8">
        <Text className="text-muted-foreground text-center">
          No files attached to this item.
        </Text>
      </View>
    );
  }

  return (
    <View className="gap-4 py-2">
      {renderSection("Media", mediaFiles)}
      {renderSection("Artwork", artworkFiles)}
      {renderSection("Subtitles", subtitleFiles)}
    </View>
  );
}
