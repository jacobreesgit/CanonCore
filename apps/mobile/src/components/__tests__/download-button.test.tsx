import React from "react";
import { render, screen, fireEvent } from "@testing-library/react-native";
import { DownloadButton } from "@/components/downloads/download-button";

// Mock @/tw styled components
jest.mock("@/tw", () => {
  const { Text, Pressable } = require("react-native");
  return { Text, Pressable };
});

// Mock the useDownload hook
jest.mock("@/hooks/use-download", () => ({
  useDownload: jest.fn(),
}));

import { useDownload } from "@/hooks/use-download";

const mockUseDownload = useDownload as jest.MockedFunction<typeof useDownload>;

const mockDownloadInput = {
  fileId: "file-1",
  itemId: "item-1",
  filename: "movie.mp4",
  mimeType: "video/mp4",
  itemName: "Test Movie",
  posterUrl: null,
  totalBytes: 1_000_000,
};

describe("DownloadButton", () => {
  beforeEach(() => {
    mockUseDownload.mockReturnValue({
      download: null,
      status: "none",
      isDownloaded: false,
      isActive: false,
      progress: 0,
      startDownload: jest.fn(),
      removeDownload: jest.fn(),
    });
  });

  it("renders 'Download' label when idle", () => {
    render(
      <DownloadButton fileId="file-1" downloadInput={mockDownloadInput} />,
    );
    expect(screen.getByText("Download")).toBeTruthy();
  });

  it("starts download on press when idle", () => {
    const startDownload = jest.fn();
    mockUseDownload.mockReturnValue({
      download: null,
      status: "none",
      isDownloaded: false,
      isActive: false,
      progress: 0,
      startDownload,
      removeDownload: jest.fn(),
    });

    render(
      <DownloadButton fileId="file-1" downloadInput={mockDownloadInput} />,
    );
    fireEvent.press(screen.getByText("Download"));
    expect(startDownload).toHaveBeenCalledWith(mockDownloadInput);
  });

  it("shows 'Downloading…' when in progress", () => {
    mockUseDownload.mockReturnValue({
      download: null,
      status: "downloading",
      isDownloaded: false,
      isActive: true,
      progress: 0.5,
      startDownload: jest.fn(),
      removeDownload: jest.fn(),
    });

    render(
      <DownloadButton fileId="file-1" downloadInput={mockDownloadInput} />,
    );
    expect(screen.getByText("Downloading\u2026")).toBeTruthy();
  });

  it("shows 'Downloaded' when complete", () => {
    mockUseDownload.mockReturnValue({
      download: null,
      status: "complete",
      isDownloaded: true,
      isActive: false,
      progress: 1,
      startDownload: jest.fn(),
      removeDownload: jest.fn(),
    });

    render(
      <DownloadButton fileId="file-1" downloadInput={mockDownloadInput} />,
    );
    expect(screen.getByText("Downloaded")).toBeTruthy();
  });

  it("shows 'Retry' when failed", () => {
    mockUseDownload.mockReturnValue({
      download: null,
      status: "failed",
      isDownloaded: false,
      isActive: false,
      progress: 0,
      startDownload: jest.fn(),
      removeDownload: jest.fn(),
    });

    render(
      <DownloadButton fileId="file-1" downloadInput={mockDownloadInput} />,
    );
    expect(screen.getByText("Retry")).toBeTruthy();
  });
});
