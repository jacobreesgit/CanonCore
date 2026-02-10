/**
 * Mobile navigation provider component.
 * Manages footer navigation state and coordinates bottom sheet interactions.
 * Implements mutual exclusion: only one sheet can be open at a time.
 */

"use client";

import * as React from "react";
import { usePathname, useRouter } from "next/navigation";
import { MobileFooterContainer } from "./mobile-footer-nav";
import { MobileSearchSheet } from "./mobile-search-sheet";
import { MobileHelpSheet } from "./mobile-help-sheet";
import { MobileSettingsSheet } from "@/components/profile/mobile-settings-sheet";
import type { GoogleDriveConnection } from "@/lib/types";

/** Transition delay for sheet mutual exclusion (ms) */
const SHEET_TRANSITION_DELAY = 150;

/**
 * Sheet types that can be opened.
 */
type SheetType = "search" | "user" | "help" | null;

/**
 * Props for MobileNavProvider component.
 */
export interface MobileNavProviderProps {
  /** Current user data (null for guests) */
  user?: {
    name: string;
    email: string;
    avatar?: string;
    username?: string | null;
    isPublic?: boolean;
    hasImage?: boolean;
    hasHeroImage?: boolean;
  } | null;
  /** Google Drive connection (null if not connected) */
  driveConnection?: GoogleDriveConnection | null;
  /** Children to render */
  children?: React.ReactNode;
}

/**
 * Mobile navigation provider that manages:
 * - Footer navigation bar with auth-aware items
 * - Search and User bottom sheets
 * - Sheet mutual exclusion (one at a time)
 * - Route change detection to close sheets
 *
 * @param user - Current user data or null for guests
 * @param driveConnection - Google Drive connection or null
 * @param children - Child components
 */
export function MobileNavProvider({
  user,
  driveConnection,
  children,
}: MobileNavProviderProps) {
  const pathname = usePathname();
  const router = useRouter();
  const [activeSheet, setActiveSheet] = React.useState<SheetType>(null);
  const pendingSheetRef = React.useRef<SheetType>(null);
  const prevPathnameRef = React.useRef(pathname);

  // Close sheets on route change
  React.useEffect(() => {
    if (pathname !== prevPathnameRef.current) {
      prevPathnameRef.current = pathname;
      if (activeSheet) {
        setActiveSheet(null);
      }
    }
  }, [pathname, activeSheet]);

  // Open a sheet with mutual exclusion
  const openSheet = React.useCallback(
    (sheet: SheetType) => {
      if (!sheet) return;

      // If same sheet is already open, close it
      if (activeSheet === sheet) {
        setActiveSheet(null);
        return;
      }

      // If another sheet is open, close it first and queue the new one
      if (activeSheet) {
        pendingSheetRef.current = sheet;
        setActiveSheet(null);
        // Open pending sheet after close animation
        setTimeout(() => {
          if (pendingSheetRef.current === sheet) {
            setActiveSheet(sheet);
            pendingSheetRef.current = null;
          }
        }, SHEET_TRANSITION_DELAY);
      } else {
        // No sheet open, open directly
        setActiveSheet(sheet);
      }
    },
    [activeSheet]
  );

  // Close the active sheet
  const closeSheet = React.useCallback(() => {
    setActiveSheet(null);
    pendingSheetRef.current = null;
  }, []);

  // Handler for search sheet open/close
  const handleSearchOpenChange = React.useCallback(
    (open: boolean) => {
      if (open) {
        openSheet("search");
      } else {
        closeSheet();
      }
    },
    [openSheet, closeSheet]
  );

  // Handler for user sheet open/close
  const handleUserOpenChange = React.useCallback(
    (open: boolean) => {
      if (open) {
        openSheet("user");
      } else {
        closeSheet();
      }
    },
    [openSheet, closeSheet]
  );

  // Handler for help sheet open/close
  const handleHelpOpenChange = React.useCallback(
    (open: boolean) => {
      if (open) {
        openSheet("help");
      } else {
        closeSheet();
      }
    },
    [openSheet, closeSheet]
  );

  return (
    <>
      {children}

      {/* Footer Navigation */}
      <MobileFooterContainer
        user={user}
        onSearchOpen={() => openSheet("search")}
        onUserOpen={() => openSheet("user")}
        onHelpOpen={() => openSheet("help")}
      />

      {/* Search Sheet */}
      <MobileSearchSheet
        open={activeSheet === "search"}
        onOpenChange={handleSearchOpenChange}
      />

      {/* Settings Sheet (only for authenticated users) */}
      {user && (
        <MobileSettingsSheet
          open={activeSheet === "user"}
          onOpenChange={handleUserOpenChange}
          user={{
            name: user.name || null,
            email: user.email,
            username: user.username ?? null,
            isPublic: user.isPublic ?? false,
            hasImage: user.hasImage ?? false,
            hasHeroImage: user.hasHeroImage ?? false,
          }}
          googleDriveConnection={driveConnection ?? null}
          onProfileChange={async () => router.refresh()}
        />
      )}

      {/* Help Sheet (for all users) */}
      <MobileHelpSheet
        open={activeSheet === "help"}
        onOpenChange={handleHelpOpenChange}
      />
    </>
  );
}
