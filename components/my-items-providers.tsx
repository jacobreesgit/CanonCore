/**
 * Client-side providers for the protected routes.
 * Wraps children with context providers.
 */

"use client";

import { ReactNode } from "react";

/**
 * Protected routes providers wrapper.
 */
export function MyItemsProviders({ children }: { children: ReactNode }) {
  return <>{children}</>;
}
