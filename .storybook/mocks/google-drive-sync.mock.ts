/**
 * Mock for lib/google-drive-sync.ts
 * Prevents googleapis from being imported in Storybook's browser build.
 */

import { fn } from "storybook/test";

// Re-export the SyncContext interface
export interface SyncContext {
  connectionId: string;
  userId: string;
  rootFolderId: string;
  stats: {
    created: number;
    updated: number;
    errors: number;
  };
  errors: Array<{ fileName: string; error: string }>;
}

// Mock sync functions
export const syncFromGoogleDrive = fn(async () => ({
  success: true,
  itemsCreated: 0,
  itemsUpdated: 0,
  itemsErrored: 0,
}));

export const syncByUserId = fn(async () => ({
  success: true,
  itemsCreated: 0,
  itemsUpdated: 0,
  itemsErrored: 0,
}));
