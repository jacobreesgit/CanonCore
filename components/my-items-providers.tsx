/**
 * Client-side providers for the protected routes.
 * Wraps children with Spotlight context provider.
 */

"use client";

import { ReactNode } from "react";
import { SpotlightProvider } from "@/contexts/spotlight-context";
import { GlobalSpotlight } from "./search/global-spotlight";

/**
 * Protected routes providers wrapper.
 * Includes Spotlight search functionality.
 */
export function MyItemsProviders({ children }: { children: ReactNode }) {
  return (
    <SpotlightProvider>
      {children}
      <GlobalSpotlight />
    </SpotlightProvider>
  );
}
