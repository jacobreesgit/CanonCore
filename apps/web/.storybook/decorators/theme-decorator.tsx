/**
 * Storybook decorator for theme context.
 * Forces dark mode only - no light mode support.
 */
import { ThemeProvider } from "next-themes";

/**
 * Decorator that provides theme context using next-themes.
 * Forces dark mode for all stories.
 *
 * @param Story - The story component to wrap
 * @returns Story wrapped with ThemeProvider in dark mode
 */
export const withTheme = (Story: React.ComponentType) => (
  <ThemeProvider attribute="class" defaultTheme="dark" forcedTheme="dark">
    <Story />
  </ThemeProvider>
);
