/**
 * Mobile footer navigation bar component.
 * Fixed bottom navigation for mobile viewports replacing the sidebar.
 * Supports navigation links and bottom sheet triggers.
 */

"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faBookOpen,
  faCircleQuestion,
  faCompass,
  faMagnifyingGlass,
  faRightToBracket,
  faUser,
} from "@fortawesome/free-solid-svg-icons";
import { cn } from "@/lib/utils";
import { useIsMobile } from "@/hooks/use-mobile";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";

/**
 * Footer navigation item configuration.
 */
export interface MobileFooterNavItem {
  /** Display label for the item */
  label: string;
  /** Icon element (FontAwesomeIcon or React element) */
  icon: React.ReactNode;
  /** Accessible label for screen readers */
  ariaLabel: string;
  /** URL for navigation (mutually exclusive with sheet) */
  href?: string;
  /** Sheet type to open (mutually exclusive with href) */
  sheet?: "search" | "user" | "help";
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
  onSheetOpen?: (sheet: "search" | "user" | "help") => void;
  /** User avatar URL for the user button */
  userAvatar?: string;
  /** User name for avatar fallback */
  userName?: string;
  /** Optional className for styling */
  className?: string;
  /** Force show regardless of viewport (for Storybook) */
  forceShow?: boolean;
}

/**
 * Fixed bottom navigation bar for mobile viewports.
 * Renders navigation links and sheet triggers with active state indication.
 * Only visible on mobile (< 1024px viewport).
 *
 * @param items - Navigation items to display
 * @param onSheetOpen - Callback when sheet trigger is pressed
 * @param userAvatar - URL for user avatar
 * @param userName - Name for avatar fallback
 * @param className - Additional styles
 */
export function MobileFooterNav({
  items,
  onSheetOpen,
  userAvatar,
  userName,
  className,
  forceShow = false,
}: MobileFooterNavProps) {
  const isMobile = useIsMobile();
  const pathname = usePathname();

  // Map item labels to data-testid values
  const labelToTestId: Record<string, string> = {
    "My Items": "nav-mobile-my-items",
    Explore: "nav-mobile-explore",
    Search: "nav-mobile-search",
    Help: "nav-mobile-help",
    Account: "nav-mobile-account",
    "Sign In": "nav-mobile-sign-in",
  };

  // Don't render on desktop (unless forceShow is true for Storybook)
  if (!isMobile && !forceShow) {
    return null;
  }

  return (
    <nav
      aria-label="Mobile navigation"
      data-testid="nav-mobile-footer"
      className={cn(
        "fixed inset-x-0 bottom-0 z-40",
        "flex h-14 items-center justify-around",
        "border-sidebar-border bg-sidebar border-t",
        "pb-[env(safe-area-inset-bottom)]",
        // Touch optimizations
        "touch-action-manipulation",
        // Landscape phones: reduced height
        "landscape:max-h-[500px]:h-12",
        className
      )}
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
              data-testid={labelToTestId[item.label]}
              className={cn(
                "flex flex-1 flex-col items-center justify-center gap-1",
                "min-h-[44px] min-w-[44px]",
                "transition-colors duration-150 ease-out",
                "active:scale-95",
                "focus-visible:ring-sidebar-ring focus-visible:ring-2 focus-visible:outline-none",
                isActive
                  ? "text-foreground"
                  : "text-sidebar-foreground/50 hover:text-sidebar-foreground"
              )}
            >
              <span
                className={cn(
                  "flex h-7 w-7 items-center justify-center rounded-md",
                  isActive && "bg-foreground text-background"
                )}
              >
                <span className="flex h-4 w-4 items-center justify-center">
                  {item.icon}
                </span>
              </span>
              <span
                className={cn(
                  "text-[10px] leading-none",
                  isActive ? "font-semibold" : "font-medium",
                  // Hide labels in landscape mode
                  "landscape:max-h-[500px]:hidden"
                )}
              >
                {item.label}
              </span>
            </Link>
          );
        }

        // Render as button for sheet triggers
        return (
          <button
            key={item.label}
            type="button"
            aria-label={item.ariaLabel}
            data-testid={labelToTestId[item.label]}
            onClick={() => item.sheet && onSheetOpen?.(item.sheet)}
            className={cn(
              "flex flex-1 flex-col items-center justify-center gap-1",
              "min-h-[44px] min-w-[44px]",
              "transition-colors duration-150 ease-out",
              "active:scale-95",
              "focus-visible:ring-sidebar-ring focus-visible:ring-2 focus-visible:outline-none",
              isActive
                ? "text-foreground"
                : "text-sidebar-foreground/50 hover:text-sidebar-foreground"
            )}
          >
            {item.sheet === "user" && userAvatar ? (
              <span
                className={cn(
                  "flex h-7 w-7 items-center justify-center rounded-md",
                  isActive && "bg-foreground text-background"
                )}
              >
                <Avatar className="h-5 w-5">
                  <AvatarImage src={userAvatar} alt={userName || "User"} />
                  <AvatarFallback className="bg-sidebar-accent text-sidebar-foreground text-[8px]">
                    {userName?.charAt(0)?.toUpperCase() || "U"}
                  </AvatarFallback>
                </Avatar>
              </span>
            ) : (
              <span
                className={cn(
                  "flex h-7 w-7 items-center justify-center rounded-md",
                  isActive && "bg-foreground text-background"
                )}
              >
                <span className="flex h-4 w-4 items-center justify-center">
                  {item.icon}
                </span>
              </span>
            )}
            <span
              className={cn(
                "text-[10px] leading-none",
                isActive ? "font-semibold" : "font-medium",
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
      icon: (
        <FontAwesomeIcon
          icon={faBookOpen}
          className="h-5 w-5"
          aria-hidden="true"
        />
      ),
      ariaLabel: "My Items",
      href: username ? `/u/${username}` : "/sign-in",
    },
    {
      label: "Explore",
      icon: (
        <FontAwesomeIcon
          icon={faCompass}
          className="h-5 w-5"
          aria-hidden="true"
        />
      ),
      ariaLabel: "Explore",
      href: "/explore",
    },
    {
      label: "Search",
      icon: (
        <FontAwesomeIcon
          icon={faMagnifyingGlass}
          className="h-5 w-5"
          aria-hidden="true"
        />
      ),
      ariaLabel: "Search",
      sheet: "search",
    },
    {
      label: "Help",
      icon: (
        <FontAwesomeIcon
          icon={faCircleQuestion}
          className="h-5 w-5"
          aria-hidden="true"
        />
      ),
      ariaLabel: "Help",
      sheet: "help",
    },
    {
      label: "Account",
      icon: (
        <FontAwesomeIcon icon={faUser} className="h-5 w-5" aria-hidden="true" />
      ),
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
      icon: (
        <FontAwesomeIcon
          icon={faCompass}
          className="h-5 w-5"
          aria-hidden="true"
        />
      ),
      ariaLabel: "Explore",
      href: "/explore",
    },
    {
      label: "Search",
      icon: (
        <FontAwesomeIcon
          icon={faMagnifyingGlass}
          className="h-5 w-5"
          aria-hidden="true"
        />
      ),
      ariaLabel: "Search",
      sheet: "search",
    },
    {
      label: "Help",
      icon: (
        <FontAwesomeIcon
          icon={faCircleQuestion}
          className="h-5 w-5"
          aria-hidden="true"
        />
      ),
      ariaLabel: "Help",
      sheet: "help",
    },
    {
      label: "Sign In",
      icon: (
        <FontAwesomeIcon
          icon={faRightToBracket}
          className="h-5 w-5"
          aria-hidden="true"
        />
      ),
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
 * @param onHelpOpen - Callback to open help sheet
 * @param className - Additional styles
 */
export function MobileFooterContainer({
  user,
  onSearchOpen,
  onUserOpen,
  onHelpOpen,
  className,
  forceShow = false,
}: MobileFooterContainerProps) {
  const items = user
    ? getAuthenticatedFooterItems(user.username)
    : getGuestFooterItems();

  const handleSheetOpen = React.useCallback(
    (sheet: "search" | "user" | "help") => {
      if (sheet === "search") {
        onSearchOpen?.();
      } else if (sheet === "user") {
        onUserOpen?.();
      } else if (sheet === "help") {
        onHelpOpen?.();
      }
    },
    [onSearchOpen, onUserOpen, onHelpOpen]
  );

  return (
    <MobileFooterNav
      items={items}
      onSheetOpen={handleSheetOpen}
      userAvatar={user?.avatar}
      userName={user?.name || undefined}
      className={className}
      forceShow={forceShow}
    />
  );
}
