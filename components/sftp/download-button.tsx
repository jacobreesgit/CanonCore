/**
 * Download button component for SFTP file downloads.
 * Compact button with precise loading state animation.
 */

"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { Download, Check, AlertCircle } from "lucide-react";

interface DownloadButtonProps {
  itemId: string;
  fileName: string;
  variant?: "default" | "outline" | "ghost";
  size?: "default" | "sm" | "icon";
  className?: string;
}

/**
 * Button that triggers file download from SFTP via API route.
 *
 * @param itemId - Item ID to download
 * @param fileName - Display name for download
 * @param variant - Button style variant
 * @param size - Button size
 * @param className - Additional CSS classes
 */
export function DownloadButton({
  itemId,
  fileName,
  variant = "ghost",
  size = "icon",
  className,
}: DownloadButtonProps) {
  const [status, setStatus] = useState<
    "idle" | "downloading" | "success" | "error"
  >("idle");

  const handleDownload = async () => {
    if (status === "downloading") return;

    setStatus("downloading");

    try {
      const response = await fetch(`/api/sftp/download/${itemId}`);

      if (!response.ok) {
        const error = await response.json().catch(() => ({}));
        throw new Error(error.error ?? "Download failed");
      }

      // Get filename from Content-Disposition header or use provided name
      const contentDisposition = response.headers.get("Content-Disposition");
      let downloadName = fileName;
      if (contentDisposition) {
        const match = contentDisposition.match(/filename="?([^"]+)"?/);
        if (match) {
          downloadName = decodeURIComponent(match[1]);
        }
      }

      // Create blob and trigger download
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = downloadName;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);

      setStatus("success");
      toast.success(`Downloaded ${downloadName}`);

      // Reset to idle after showing success
      setTimeout(() => setStatus("idle"), 2000);
    } catch (error) {
      setStatus("error");
      toast.error(error instanceof Error ? error.message : "Download failed");
      setTimeout(() => setStatus("idle"), 2000);
    }
  };

  const isDownloading = status === "downloading";

  return (
    <Button
      variant={variant}
      size={size}
      onClick={handleDownload}
      disabled={isDownloading}
      className={cn(
        "relative transition-all duration-200",
        // Success pulse
        status === "success" && "text-emerald-500",
        // Error state
        status === "error" && "text-destructive",
        className
      )}
      title={`Download ${fileName}`}
    >
      {status === "success" ? (
        <Check className="animate-in zoom-in-50 size-4 duration-200" />
      ) : status === "error" ? (
        <AlertCircle className="animate-in zoom-in-50 size-4 duration-200" />
      ) : isDownloading ? (
        <div className="relative size-4">
          {/* Spinning ring */}
          <div className="absolute inset-0 animate-spin rounded-full border-2 border-current border-t-transparent" />
          {/* Pulsing center dot */}
          <div className="absolute inset-[5px] animate-pulse rounded-full bg-current" />
        </div>
      ) : (
        <Download
          className={cn(
            "size-4 transition-transform duration-200",
            "group-hover:translate-y-0.5"
          )}
        />
      )}
      <span className="sr-only">Download {fileName}</span>
    </Button>
  );
}
