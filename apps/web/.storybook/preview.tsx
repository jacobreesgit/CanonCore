/**
 * Storybook preview configuration file.
 * Configures viewports, backgrounds, accessibility, decorators, and global types.
 */
import type { Preview, Decorator } from "@storybook/nextjs";
import { themes } from "storybook/theming";
import { initialize, mswLoader } from "msw-storybook-addon";
import { useEffect } from "react";

import "./fonts.css";
import "../app/globals.css";
import { handlers } from "./mocks/handlers";

// Initialize MSW with onUnhandledRequest to allow real network requests
initialize({
  onUnhandledRequest: "bypass",
});

/**
 * Maps internal paths to Storybook story IDs for navigation between stories.
 */
const PATH_TO_STORY: Record<string, string> = {
  "/": "navigation-appsidebar--guest-home",
  "/docs": "navigation-appsidebar--authenticated-docs",
  "/explore": "navigation-appsidebar--authenticated-home",
};

/**
 * Wrapper component that handles link navigation in stories.
 * Maps internal paths to corresponding Storybook stories.
 * External links are blocked to prevent breaking the Storybook iframe.
 */
function NoNavigationWrapper({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      const link = target.closest("a");
      if (!link || !link.href || link.href.startsWith("javascript:")) {
        return;
      }

      const url = new URL(link.href, window.location.origin);
      const isInternal = url.origin === window.location.origin;

      if (!isInternal) {
        e.preventDefault();
        console.log("[Storybook] External navigation prevented:", link.href);
        return;
      }

      // Check if we have a story mapping for this path
      const storyId = PATH_TO_STORY[url.pathname];
      if (storyId && window.top) {
        e.preventDefault();
        // Navigate Storybook to the mapped story
        const storyUrl = new URL(window.top.location.href);
        storyUrl.searchParams.set("path", `/story/${storyId}`);
        window.top.location.href = storyUrl.toString();
      }
    };

    document.addEventListener("click", handleClick, true);
    return () => document.removeEventListener("click", handleClick, true);
  }, []);

  return <>{children}</>;
}

const withNoNavigation: Decorator = (Story) => (
  <NoNavigationWrapper>
    <Story />
  </NoNavigationWrapper>
);

// Custom viewports matching project's responsive breakpoints
const customViewports = {
  mobile: {
    name: "Mobile (iPhone 14)",
    styles: { width: "390px", height: "844px" },
  },
  mobileLandscape: {
    name: "Mobile Landscape",
    styles: { width: "844px", height: "390px" },
  },
  tablet: {
    name: "Tablet (iPad) — Mobile Layout",
    styles: { width: "768px", height: "1024px" },
  },
  desktop: {
    name: "Desktop",
    styles: { width: "1280px", height: "800px" },
  },
  desktopLarge: {
    name: "Desktop Large",
    styles: { width: "1440px", height: "900px" },
  },
  desktopXL: {
    name: "Desktop XL",
    styles: { width: "1920px", height: "1080px" },
  },
};

const preview: Preview = {
  parameters: {
    docs: {
      autodocs: "tag",
      theme: themes.dark,
    },
    nextjs: {
      appDirectory: true,
    },
    msw: {
      handlers,
    },
    viewport: {
      options: customViewports,
    },
    backgrounds: {
      default: "dark",
      values: [
        { name: "dark", value: "#0a0a0a" },
        { name: "brand", value: "#1a1a2e" },
      ],
    },
    layout: "centered",
    a11y: {
      test: "error",
      options: {
        runOnly: {
          type: "tag",
          values: ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"],
        },
        rules: {
          // Third-party component structure issues (unfixable in our code):
          // shadcn Sidebar Collapsible wraps <li> in <div>, breaking <ul>/<li> hierarchy
          list: { enabled: false },
          listitem: { enabled: false },
          // cmdk library renders role="listbox" with div children instead of role="option"
          "aria-required-children": { enabled: false },
          // DiceUI file-upload uses Button wrapper with nested interactive elements
          "nested-interactive": { enabled: false },
        },
      },
    },
  },
  decorators: [
    withNoNavigation,
    // Force dark mode — app is always dark, no light mode
    (Story) => (
      <div className="dark bg-background text-foreground">
        <Story />
      </div>
    ),
  ],
  loaders: [mswLoader],
  initialGlobals: {
    viewport: { value: "desktop", isRotated: false },
  },
  globalTypes: {
    reducedMotion: {
      description: "Reduced motion preference",
      defaultValue: "no-preference",
      toolbar: {
        title: "Motion",
        icon: "accessibility",
        items: [
          { value: "no-preference", title: "Normal motion" },
          { value: "reduce", title: "Reduced motion" },
        ],
        dynamicTitle: true,
      },
    },
  },
};

export default preview;
