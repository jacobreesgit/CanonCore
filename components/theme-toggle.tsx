/**
 * Theme toggle button component.
 * Switches between light and dark modes with sun/moon icons.
 */

"use client";

import { useEffect, useState } from "react";
import { Moon, Sun } from "lucide-react";
import { useTheme } from "next-themes";

import { Button } from "@/components/ui/button";

/**
 * Renders a toggle button that cycles between light and dark themes.
 * Shows sun icon in dark mode, moon icon in light mode.
 * Handles hydration by waiting for mount before rendering.
 */
export function ThemeToggle() {
  const [mounted, setMounted] = useState(false);
  const { theme, setTheme } = useTheme();

  useEffect(() => {
    // Standard pattern for detecting client-side mount to avoid hydration mismatch
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setMounted(true);
  }, []);

  const toggleTheme = () => {
    setTheme(theme === "dark" ? "light" : "dark");
  };

  // Prevent hydration mismatch by rendering skeleton until mounted
  if (!mounted) {
    return (
      <Button
        variant="ghost"
        size="icon"
        className="size-8"
        data-testid="theme-toggle"
        disabled
      >
        <span className="size-4" />
        <span className="sr-only">Toggle theme</span>
      </Button>
    );
  }

  return (
    <Button
      variant="ghost"
      size="icon"
      onClick={toggleTheme}
      className="size-8 cursor-pointer"
      data-testid="theme-toggle"
    >
      <Sun
        aria-hidden="true"
        className="size-4 scale-100 rotate-0 transition-transform dark:scale-0 dark:-rotate-90"
      />
      <Moon
        aria-hidden="true"
        className="absolute size-4 scale-0 rotate-90 transition-transform dark:scale-100 dark:rotate-0"
      />
      <span className="sr-only">Toggle theme</span>
    </Button>
  );
}
