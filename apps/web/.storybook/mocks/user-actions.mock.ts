/**
 * Mock for lib/user-actions.ts
 * Prevents sharp from being imported in Storybook's browser build.
 */

import { fn } from "storybook/test";

// Types
type ActionResult<T = void> =
  | { success: true; data?: T }
  | { success: false; error: string };

export type ViewMode = "grid" | "tree";
export type SortOption =
  | "custom"
  | "name-asc"
  | "name-desc"
  | "newest"
  | "oldest"
  | "updated";

export interface UserPreferences {
  viewMode: ViewMode;
  sortBy: SortOption;
}

// Mock functions
export const updateProfile = fn(
  async (): Promise<ActionResult<void>> => ({
    success: true,
  })
);

export const changePassword = fn(
  async (): Promise<ActionResult<void>> => ({
    success: true,
  })
);

export const uploadProfileImage = fn(
  async (): Promise<ActionResult<void>> => ({
    success: true,
  })
);

export const uploadHeroImage = fn(
  async (): Promise<ActionResult<void>> => ({
    success: true,
  })
);

export const removeProfileImage = fn(
  async (): Promise<ActionResult<void>> => ({
    success: true,
  })
);

export const removeHeroImage = fn(
  async (): Promise<ActionResult<void>> => ({
    success: true,
  })
);

export const getProfile = fn(
  async (): Promise<
    ActionResult<{
      id: string;
      name: string | null;
      email: string;
      username: string | null;
      hasImage: boolean;
      hasHeroImage: boolean;
    }>
  > => ({
    success: true,
    data: {
      id: "mock-user-id",
      name: "Mock User",
      email: "mock@example.com",
      username: "mockuser",
      hasImage: false,
      hasHeroImage: false,
    },
  })
);

export const getPreferences = fn(
  async (): Promise<ActionResult<UserPreferences>> => ({
    success: true,
    data: {
      viewMode: "grid",
      sortBy: "custom",
    },
  })
);

export const updatePreferences = fn(
  async (): Promise<ActionResult<void>> => ({
    success: true,
  })
);
