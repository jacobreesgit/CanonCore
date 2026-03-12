/**
 * Theme provider wrapper for next-themes.
 * Forces dark mode only - no light mode support.
 */

"use client";

import { ThemeProvider as NextThemesProvider } from "next-themes";

/**
 * Wraps children with next-themes provider for theme management.
 * Forces dark mode only with no switching capability.
 *
 * @param children - React children to wrap with theme context
 */
export function ThemeProvider({ children }: { children: React.ReactNode }) {
  return (
    <NextThemesProvider
      attribute="class"
      defaultTheme="dark"
      forcedTheme="dark"
      disableTransitionOnChange
    >
      {children}
    </NextThemesProvider>
  );
}
