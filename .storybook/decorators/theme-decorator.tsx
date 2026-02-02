/**
 * Storybook decorator for theme context.
 * Provides next-themes ThemeProvider for light/dark mode testing.
 */
import { ThemeProvider } from "next-themes";

/**
 * Decorator that provides theme context using next-themes.
 *
 * @param Story - The story component to wrap
 * @returns Story wrapped with ThemeProvider
 */
export const withTheme = (Story: React.ComponentType) => (
  <ThemeProvider attribute="class" defaultTheme="system" enableSystem>
    <Story />
  </ThemeProvider>
);
