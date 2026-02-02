/**
 * Mock for lib/google-drive-actions.ts
 * Prevents googleapis from being imported in Storybook's browser build.
 */

import { fn } from "storybook/test";

// Mock action result type
type ActionResult<T = void> =
  | { success: true; data?: T }
  | { success: false; error: string };

// Mock functions
export const initiateGoogleDriveOAuth = fn(async () => ({
  success: true,
  url: "https://mock-oauth-url.com",
}));

export const disconnectGoogleDrive = fn(async () => ({
  success: true,
}));

export const getGoogleDriveConnection = fn(async () => ({
  id: "mock-connection-id",
  userId: "mock-user-id",
  name: "Mock Connection",
  email: "mock@example.com",
  rootFolderId: "mock-root-folder-id",
  isActive: true,
  needsReauth: false,
  lastSyncAt: new Date(),
  lastError: null,
  quotaBytesUsed: BigInt(1000000000),
  quotaBytesTotal: BigInt(15000000000),
  createdAt: new Date(),
  updatedAt: new Date(),
}));

export const createDriveFolderOnly = fn(
  async (): Promise<ActionResult<{ driveFileId: string }>> => ({
    success: true,
    data: { driveFileId: "mock-drive-folder-id" },
  })
);

export const createFolderInGoogleDrive = fn(
  async (): Promise<ActionResult<{ itemId: string; driveFileId: string }>> => ({
    success: true,
    data: {
      itemId: "mock-item-id",
      driveFileId: "mock-drive-folder-id",
    },
  })
);

export const deleteItemFromGoogleDrive = fn(
  async (): Promise<ActionResult> => ({
    success: true,
  })
);

export const deleteFileFromDrive = fn(async () => undefined);

export const renameItemInGoogleDrive = fn(
  async (): Promise<ActionResult> => ({
    success: true,
  })
);

export const moveItemInGoogleDrive = fn(
  async (): Promise<ActionResult> => ({
    success: true,
  })
);
