/**
 * Mock for lib/email.ts
 * Prevents Resend and env imports in Storybook's browser build.
 */

import { fn } from "storybook/test";

/**
 * Mock for sendPasswordResetEmail function.
 */
export const sendPasswordResetEmail = fn(
  async (_email: string, _token: string): Promise<void> => {
    // No-op in Storybook
  }
);
