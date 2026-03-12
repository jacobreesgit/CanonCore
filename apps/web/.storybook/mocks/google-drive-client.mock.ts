/**
 * Mock for lib/google-drive-client.ts
 * Prevents googleapis from being imported in Storybook's browser build.
 */

import { fn } from "storybook/test";

// Mock types
export interface RootFolderResult {
  id: string;
  wasExisting: boolean;
}

export type RootFolderStatus =
  | { exists: true; trashed: boolean }
  | { exists: false };

export interface UploadProgress {
  bytesUploaded: number;
  totalBytes: number;
  percentage: number;
}

export interface BatchDeleteResult {
  succeeded: string[];
  failed: Array<{ fileId: string; error: string }>;
}

export interface BatchMoveResult {
  succeeded: string[];
  failed: Array<{ fileId: string; error: string }>;
}

export interface MoveFromDifferentParent {
  fileId: string;
  oldParentId: string;
}

// Mock functions
export const generateOAuthState = fn(() => "mock-oauth-state");

export const verifyOAuthState = fn(() => ({
  userId: "mock-user-id",
  timestamp: Date.now(),
}));

export const withRateLimit = fn(<T>(func: () => Promise<T>) => func());

export const refreshAccessToken = fn(async () => "mock-access-token");

export const getDriveClient = fn(async () => ({
  files: {
    list: fn(async () => ({ data: { files: [] } })),
    get: fn(async () => ({ data: {} })),
    create: fn(async () => ({ data: { id: "mock-file-id" } })),
    update: fn(async () => ({ data: {} })),
    delete: fn(async () => ({})),
  },
  about: {
    get: fn(async () => ({ data: { storageQuota: {} } })),
  },
  changes: {
    getStartPageToken: fn(async () => ({ data: { startPageToken: "1" } })),
    list: fn(async () => ({ data: { changes: [] } })),
  },
}));

export const getDriveClientFromRefreshToken = fn(async () =>
  getDriveClient({} as Parameters<typeof getDriveClient>[0])
);

export const getAuthorizationUrl = fn(() => "https://mock-auth-url.com");

export const exchangeCodeForTokens = fn(async () => ({
  accessToken: "mock-access-token",
  refreshToken: "mock-refresh-token",
  expiresIn: 3600,
}));

export const getUserEmail = fn(async () => "mock@example.com");

export const createRootFolder = fn(
  async (): Promise<RootFolderResult> => ({
    id: "mock-root-folder-id",
    wasExisting: false,
  })
);

export const checkRootFolderStatus = fn(
  async (): Promise<RootFolderStatus> => ({
    exists: true,
    trashed: false,
  })
);

export const uploadFile = fn(async () => ({
  id: "mock-file-id",
  name: "mock-file.txt",
}));

export const downloadFile = fn(async () => new Uint8Array([109, 111, 99, 107]));

export const listFiles = fn(async () => ({
  files: [],
  nextPageToken: undefined,
}));

export const createFolder = fn(async () => "mock-folder-id");

export const deleteFile = fn(async () => undefined);

export const permanentlyDeleteFile = fn(async () => undefined);

export const emptyTrash = fn(async () => undefined);

export const renameFile = fn(async () => undefined);

export const moveFile = fn(async () => undefined);

export const createResumableUploadUrl = fn(
  async () => "https://mock-upload-url.com"
);

export const batchDelete = fn(
  async (): Promise<BatchDeleteResult> => ({
    succeeded: [],
    failed: [],
  })
);

export const batchMove = fn(
  async (): Promise<BatchMoveResult> => ({
    succeeded: [],
    failed: [],
  })
);

export const batchMoveFromDifferentParents = fn(
  async (): Promise<BatchMoveResult> => ({
    succeeded: [],
    failed: [],
  })
);
