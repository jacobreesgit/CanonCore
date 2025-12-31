/**
 * Theme provider wrapper for next-themes.
 * Enables dark mode support with system preference detection.
 */

"use client";

import { ThemeProvider as NextThemesProvider } from "next-themes";

/**
 * Wraps children with next-themes provider for theme management.
 * Uses class attribute for dark mode and defaults to system preference.
 *
 * @param children - React children to wrap with theme context
 */
export function ThemeProvider({ children }: { children: React.ReactNode }) {
  return (
    <NextThemesProvider
      attribute="class"
      defaultTheme="system"
      enableSystem
      disableTransitionOnChange
    >
      {children}
    </NextThemesProvider>
  );
}
