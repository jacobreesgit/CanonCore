/**
 * Mobile footer navigation bar component.
 * Fixed bottom navigation for mobile viewports replacing the sidebar.
 * Supports navigation links and bottom sheet triggers.
 */

"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Compass,
  HelpCircle,
  Library,
  LogIn,
  Moon,
  Search,
  Settings,
  Sun,
  User,
} from "lucide-react";
import { useTheme } from "next-themes";
import { cn } from "@/lib/utils";
import { useIsMobile } from "@/hooks/use-mobile";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";

/**
 * Footer navigation item configuration.
 */
export interface MobileFooterNavItem {
  /** Display label for the item */
  label: string;
  /** Lucide icon component or React element */
  icon: React.ReactNode;
  /** Accessible label for screen readers */
  ariaLabel: string;
  /** URL for navigation (mutually exclusive with sheet/action) */
  href?: string;
  /** Sheet type to open (mutually exclusive with href/action) */
  sheet?: "search" | "user" | "settings" | "help";
  /** Action type for special buttons (mutually exclusive with href/sheet) */
  action?: "theme";
  /** Whether this is the active route */
  isActive?: boolean;
}

/**
 * Props for MobileFooterNav component.
 */
export interface MobileFooterNavProps {
  /** Items to display in the footer */
  items: MobileFooterNavItem[];
  /** Callback when a sheet trigger is pressed */
  onSheetOpen?: (sheet: "search" | "user" | "settings" | "help") => void;
  /** Callback when an action is triggered */
  onAction?: (action: "theme") => void;
  /** User avatar URL for the user button */
  userAvatar?: string;
  /** User name for avatar fallback */
  userName?: string;
  /** Current theme (for theme toggle icon) */
  currentTheme?: string;
  /** Optional className for styling */
  className?: string;
  /** Force show regardless of viewport (for Storybook) */
  forceShow?: boolean;
}

/**
 * Fixed bottom navigation bar for mobile viewports.
 * Renders navigation links and sheet triggers with active state indication.
 * Only visible on mobile (< 768px viewport).
 *
 * @param items - Navigation items to display
 * @param onSheetOpen - Callback when sheet trigger is pressed
 * @param onAction - Callback when action is triggered
 * @param userAvatar - URL for user avatar
 * @param userName - Name for avatar fallback
 * @param currentTheme - Current theme for toggle icon
 * @param className - Additional styles
 */
export function MobileFooterNav({
  items,
  onSheetOpen,
  onAction,
  userAvatar,
  userName,
  currentTheme,
  className,
  forceShow = false,
}: MobileFooterNavProps) {
  const isMobile = useIsMobile();
  const pathname = usePathname();

  // Don't render on desktop (unless forceShow is true for Storybook)
  if (!isMobile && !forceShow) {
    return null;
  }

  return (
    <nav
      aria-label="Mobile navigation"
      className={cn(
        "fixed inset-x-0 bottom-0 z-40",
        "flex h-16 items-center justify-around",
        "bg-background/95 border-t backdrop-blur-md",
        "pb-[env(safe-area-inset-bottom)]",
        // Dark mode: slightly higher opacity
        "dark:bg-background/98",
        // Touch optimizations
        "touch-action-manipulation",
        // Landscape phones: reduced height
        "landscape:max-h-[500px]:h-12",
        className
      )}
      style={{
        // Fallback for devices without backdrop-blur support
        WebkitBackdropFilter: "blur(8px)",
      }}
    >
      {items.map((item) => {
        // Determine active state from pathname or explicit isActive prop
        const isActive =
          item.isActive ??
          (item.href
            ? pathname === item.href || pathname.startsWith(`${item.href}/`)
            : false);

        // Render as link or button depending on item type
        if (item.href) {
          return (
            <Link
              key={item.label}
              href={item.href}
              aria-label={item.ariaLabel}
              aria-current={isActive ? "page" : undefined}
              className={cn(
                "flex flex-1 flex-col items-center justify-center gap-0.5",
                "min-h-[44px] min-w-[44px]",
                "transition-colors duration-150 ease-out",
                "active:scale-95",
                "focus-visible:ring-ring focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none",
                isActive
                  ? "text-primary"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              <span className="flex h-5 w-5 items-center justify-center">
                {item.icon}
              </span>
              <span
                className={cn(
                  "text-[10px] leading-none font-medium",
                  // Hide labels in landscape mode
                  "landscape:max-h-[500px]:hidden"
                )}
              >
                {item.label}
              </span>
            </Link>
          );
        }

        // Render as button for action items (like theme toggle)
        if (item.action) {
          // Determine icon for theme toggle based on current theme
          const actionIcon =
            item.action === "theme" ? (
              currentTheme === "dark" ? (
                <Sun className="h-5 w-5" aria-hidden="true" />
              ) : (
                <Moon className="h-5 w-5" aria-hidden="true" />
              )
            ) : (
              item.icon
            );

          const actionLabel =
            item.action === "theme"
              ? currentTheme === "dark"
                ? "Light"
                : "Dark"
              : item.label;

          return (
            <button
              key={item.label}
              type="button"
              aria-label={item.ariaLabel}
              onClick={() => item.action && onAction?.(item.action)}
              className={cn(
                "flex flex-1 flex-col items-center justify-center gap-0.5",
                "min-h-[44px] min-w-[44px]",
                "transition-colors duration-150 ease-out",
                "active:scale-95",
                "focus-visible:ring-ring focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none",
                "text-muted-foreground hover:text-foreground"
              )}
            >
              <span className="flex h-5 w-5 items-center justify-center">
                {actionIcon}
              </span>
              <span
                className={cn(
                  "text-[10px] leading-none font-medium",
                  "landscape:max-h-[500px]:hidden"
                )}
              >
                {actionLabel}
              </span>
            </button>
          );
        }

        // Render as button for sheet triggers
        return (
          <button
            key={item.label}
            type="button"
            aria-label={item.ariaLabel}
            onClick={() => item.sheet && onSheetOpen?.(item.sheet)}
            className={cn(
              "flex flex-1 flex-col items-center justify-center gap-0.5",
              "min-h-[44px] min-w-[44px]",
              "transition-colors duration-150 ease-out",
              "active:scale-95",
              "focus-visible:ring-ring focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none",
              isActive
                ? "text-primary"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            {item.sheet === "user" && userAvatar ? (
              <Avatar className="h-5 w-5 grayscale">
                <AvatarImage src={userAvatar} alt={userName || "User"} />
                <AvatarFallback className="bg-primary text-primary-foreground text-[8px]">
                  {userName?.charAt(0)?.toUpperCase() || "U"}
                </AvatarFallback>
              </Avatar>
            ) : (
              <span className="flex h-5 w-5 items-center justify-center">
                {item.icon}
              </span>
            )}
            <span
              className={cn(
                "text-[10px] leading-none font-medium",
                // Hide labels in landscape mode
                "landscape:max-h-[500px]:hidden"
              )}
            >
              {item.label}
            </span>
          </button>
        );
      })}
    </nav>
  );
}

/**
 * Authenticated user footer items.
 *
 * @param username - User's username for profile URL
 * @returns Array of navigation items for authenticated users
 */
export function getAuthenticatedFooterItems(
  username: string | null | undefined
): MobileFooterNavItem[] {
  return [
    {
      label: "My Items",
      icon: <Library className="h-5 w-5" aria-hidden="true" />,
      ariaLabel: "My Items",
      href: username ? `/u/${username}` : "/sign-in",
    },
    {
      label: "Explore",
      icon: <Compass className="h-5 w-5" aria-hidden="true" />,
      ariaLabel: "Explore",
      href: "/explore",
    },
    {
      label: "Search",
      icon: <Search className="h-5 w-5" aria-hidden="true" />,
      ariaLabel: "Search",
      sheet: "search",
    },
    {
      label: "Help",
      icon: <HelpCircle className="h-5 w-5" aria-hidden="true" />,
      ariaLabel: "Help",
      sheet: "help",
    },
    {
      label: "Account",
      icon: <User className="h-5 w-5" aria-hidden="true" />,
      ariaLabel: "Account menu",
      sheet: "user",
    },
  ];
}

/**
 * Guest user footer items.
 *
 * @returns Array of navigation items for guest users
 */
export function getGuestFooterItems(): MobileFooterNavItem[] {
  return [
    {
      label: "Explore",
      icon: <Compass className="h-5 w-5" aria-hidden="true" />,
      ariaLabel: "Explore",
      href: "/explore",
    },
    {
      label: "Search",
      icon: <Search className="h-5 w-5" aria-hidden="true" />,
      ariaLabel: "Search",
      sheet: "search",
    },
    {
      label: "Help",
      icon: <HelpCircle className="h-5 w-5" aria-hidden="true" />,
      ariaLabel: "Help",
      sheet: "help",
    },
    {
      label: "Settings",
      icon: <Settings className="h-5 w-5" aria-hidden="true" />,
      ariaLabel: "Settings",
      sheet: "settings",
    },
    {
      label: "Sign In",
      icon: <LogIn className="h-5 w-5" aria-hidden="true" />,
      ariaLabel: "Sign in",
      href: "/sign-in",
    },
  ];
}

/**
 * Container component that manages footer state and sheet coordination.
 * Renders the footer nav with appropriate items based on auth state.
 */
export interface MobileFooterContainerProps {
  /** Current user data (null for guests) */
  user?: {
    name?: string | null;
    email?: string | null;
    username?: string | null;
    avatar?: string;
  } | null;
  /** Callback when search sheet should open */
  onSearchOpen?: () => void;
  /** Callback when user sheet should open */
  onUserOpen?: () => void;
  /** Callback when settings sheet should open (guests only) */
  onSettingsOpen?: () => void;
  /** Callback when help sheet should open */
  onHelpOpen?: () => void;
  /** Optional className */
  className?: string;
  /** Force show regardless of viewport (for Storybook) */
  forceShow?: boolean;
}

/**
 * Manages footer navigation state based on authentication.
 * Coordinates sheet opening through callbacks.
 *
 * @param user - Current user data or null
 * @param onSearchOpen - Callback to open search sheet
 * @param onUserOpen - Callback to open user sheet
 * @param onSettingsOpen - Callback to open settings sheet (guests)
 * @param onHelpOpen - Callback to open help sheet
 * @param className - Additional styles
 */
export function MobileFooterContainer({
  user,
  onSearchOpen,
  onUserOpen,
  onSettingsOpen,
  onHelpOpen,
  className,
  forceShow = false,
}: MobileFooterContainerProps) {
  const { theme, setTheme } = useTheme();
  const items = user
    ? getAuthenticatedFooterItems(user.username)
    : getGuestFooterItems();

  const handleSheetOpen = React.useCallback(
    (sheet: "search" | "user" | "settings" | "help") => {
      if (sheet === "search") {
        onSearchOpen?.();
      } else if (sheet === "user") {
        onUserOpen?.();
      } else if (sheet === "settings") {
        onSettingsOpen?.();
      } else if (sheet === "help") {
        onHelpOpen?.();
      }
    },
    [onSearchOpen, onUserOpen, onSettingsOpen, onHelpOpen]
  );

  const handleAction = React.useCallback(
    (action: "theme") => {
      if (action === "theme") {
        setTheme(theme === "dark" ? "light" : "dark");
      }
    },
    [theme, setTheme]
  );

  return (
    <MobileFooterNav
      items={items}
      onSheetOpen={handleSheetOpen}
      onAction={handleAction}
      userAvatar={user?.avatar}
      userName={user?.name || undefined}
      currentTheme={theme}
      className={className}
      forceShow={forceShow}
    />
  );
}
