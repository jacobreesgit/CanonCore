/**
 * Mock for lib/google-drive-upload.ts
 * Prevents googleapis from being imported in Storybook's browser build.
 */

import { fn } from "storybook/test";

// Re-export types
export interface UploadFileInput {
  name: string;
  mimeType: string;
}

export interface UploadSession {
  fileName: string;
  uploadUrl: string;
  sessionToken: string;
}

// Mock upload functions
export const createUploadSessions = fn(
  async (
    _itemId: string,
    files: UploadFileInput[],
    _origin: string
  ): Promise<{
    success: boolean;
    sessions?: UploadSession[];
    error?: string;
  }> => ({
    success: true,
    sessions: files.map((file) => ({
      fileName: file.name,
      uploadUrl: "https://mock-upload-url.com",
      sessionToken: "mock-session-token",
    })),
  })
);

export const confirmUpload = fn(
  async (): Promise<{
    success: boolean;
    itemFile?: { id: string; filename: string; fileType: string };
    error?: string;
  }> => ({
    success: true,
    itemFile: {
      id: "mock-file-id",
      filename: "mock-file.mp4",
      fileType: "MEDIA",
    },
  })
);

export const uploadBuffer = fn(
  async (): Promise<{
    success: boolean;
    data?: { driveFileId: string };
    error?: string;
  }> => ({
    success: true,
    data: { driveFileId: "mock-drive-file-id" },
  })
);
