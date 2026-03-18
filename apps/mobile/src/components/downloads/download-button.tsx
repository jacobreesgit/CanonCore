import { useCallback } from "react";
import { Text, Pressable } from "@/tw";
import { ActivityIndicator, Alert } from "react-native";
import { FontAwesomeIcon } from "@fortawesome/react-native-fontawesome";
import {
  faArrowDown,
  faClock,
  faCircleCheck,
  faRotateRight,
} from "@fortawesome/free-solid-svg-icons";
import { useDownload } from "@/hooks/use-download";
import type { CreateDownloadInput } from "@/db/download-dao";

interface DownloadButtonProps {
  fileId: string;
  /** Input for creating the download if not yet queued */
  downloadInput: CreateDownloadInput;
  /** Compact variant for file list rows (icon only) */
  variant?: "default" | "compact";
}

export function DownloadButton({
  fileId,
  downloadInput,
  variant = "default",
}: DownloadButtonProps) {
  const { status, startDownload, removeDownload } = useDownload(fileId);

  const handlePress = useCallback(async () => {
    switch (status) {
      case "none":
      case "failed":
        await startDownload(downloadInput);
        break;
      case "complete":
        Alert.alert(
          "Remove Download",
          "This will delete the downloaded file from your device.",
          [
            { text: "Cancel", style: "cancel" },
            {
              text: "Remove",
              style: "destructive",
              onPress: () => removeDownload(),
            },
          ],
        );
        break;
      // queued/downloading — no action on tap
    }
  }, [status, startDownload, removeDownload, downloadInput]);

  const handleLongPress = useCallback(() => {
    if (
      status === "queued" ||
      status === "downloading" ||
      status === "complete"
    ) {
      Alert.alert(
        "Remove Download",
        status === "complete"
          ? "Delete the downloaded file?"
          : "Cancel this download?",
        [
          { text: "Keep", style: "cancel" },
          {
            text: "Remove",
            style: "destructive",
            onPress: () => removeDownload(),
          },
        ],
      );
    }
  }, [status, removeDownload]);

  if (variant === "compact") {
    return (
      <Pressable
        onPress={handlePress}
        onLongPress={handleLongPress}
        hitSlop={8}
        className="items-center justify-center w-8 h-8"
      >
        {renderIcon(status)}
      </Pressable>
    );
  }

  return (
    <Pressable
      onPress={handlePress}
      onLongPress={handleLongPress}
      className="flex-row items-center gap-2 bg-white/10 rounded-lg px-4 py-2.5"
      testID={
        status === "none" || status === "failed"
          ? "download-button"
          : status === "queued" || status === "downloading"
            ? "download-progress"
            : status === "complete"
              ? "download-complete"
              : undefined
      }
    >
      {renderIcon(status)}
      <Text className="text-white text-sm font-medium">{getLabel(status)}</Text>
    </Pressable>
  );
}

function renderIcon(status: string) {
  switch (status) {
    case "none":
      return <FontAwesomeIcon icon={faArrowDown} size={14} color="#ffffff" />;
    case "queued":
      return (
        <FontAwesomeIcon
          icon={faClock}
          size={14}
          color="rgba(255, 255, 255, 0.5)"
        />
      );
    case "downloading":
      return <ActivityIndicator size="small" color="#ffffff" />;
    case "complete":
      return <FontAwesomeIcon icon={faCircleCheck} size={14} color="#22c55e" />;
    case "failed":
      return <FontAwesomeIcon icon={faRotateRight} size={14} color="#ef4444" />;
    default:
      return null;
  }
}

function getLabel(status: string): string {
  switch (status) {
    case "none":
      return "Download";
    case "queued":
      return "Queued";
    case "downloading":
      return "Downloading\u2026";
    case "complete":
      return "Downloaded";
    case "failed":
      return "Retry";
    default:
      return "Download";
  }
}
