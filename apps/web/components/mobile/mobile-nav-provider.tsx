/**
 * Mobile navigation provider component.
 * Manages footer navigation state and coordinates bottom sheet interactions.
 * Implements mutual exclusion: only one sheet can be open at a time.
 */

"use client";

import * as React from "react";
import { usePathname, useRouter } from "next/navigation";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faTriangleExclamation } from "@fortawesome/free-solid-svg-icons";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { MobileFooterContainer } from "./mobile-footer-nav";
import { MobileSearchSheet } from "./mobile-search-sheet";
import { MobileHelpSheet } from "./mobile-help-sheet";
import { MobileSettingsSheet } from "@/components/profile/mobile-settings-sheet";
import { useGoogleDriveReconnect } from "@/hooks/use-google-drive-reconnect";
import { resendVerificationEmail } from "@/lib/auth-actions";
import { VERIFICATION_MESSAGES } from "@/lib/messages";
import { DRIVE_MESSAGES } from "@/lib/constants/messages";
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
    bio?: string | null;
  } | null;
  /** Google Drive connection (null if not connected) */
  driveConnection?: GoogleDriveConnection | null;
  /** Whether user's email is unverified (shows verification nudge banner) */
  emailUnverified?: boolean;
  /** Whether Google Drive needs re-authentication (shows reconnect banner) */
  driveNeedsReauth?: boolean;
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
  emailUnverified,
  driveNeedsReauth,
  children,
}: MobileNavProviderProps) {
  const pathname = usePathname();
  const router = useRouter();
  const [activeSheet, setActiveSheet] = React.useState<SheetType>(null);
  const pendingSheetRef = React.useRef<SheetType>(null);
  const prevPathnameRef = React.useRef(pathname);
  const [isResending, startResendTransition] = React.useTransition();
  const { isReconnecting, handleReconnect } = useGoogleDriveReconnect();

  /** Resends email verification to the authenticated user. */
  const handleResendVerification = React.useCallback(() => {
    startResendTransition(async () => {
      const result = await resendVerificationEmail();
      if (result.success) {
        toast.success(VERIFICATION_MESSAGES.RESEND_SUCCESS);
      } else {
        toast.error(result.error || VERIFICATION_MESSAGES.RESEND_FAIL);
      }
    });
  }, []);

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

      {/* Drive reconnect banner takes priority over email verification (mobile only) */}
      {driveNeedsReauth ? (
        <div
          role="alert"
          aria-live="assertive"
          className="fixed inset-x-0 top-0 z-40 flex items-center gap-3 border-b border-[var(--glass-border)] bg-[var(--glass-bg)] px-4 py-2 backdrop-blur-md lg:hidden"
        >
          <FontAwesomeIcon
            icon={faTriangleExclamation}
            className="size-4 shrink-0 text-amber-400"
            aria-hidden="true"
          />
          <p className="flex-1 text-sm text-amber-200">
            {DRIVE_MESSAGES.DISCONNECTED_BANNER}
          </p>
          <Button
            variant="ghost"
            size="sm"
            className="min-h-[44px] shrink-0"
            disabled={isReconnecting}
            onClick={handleReconnect}
          >
            {isReconnecting ? "Connecting..." : "Reconnect"}
          </Button>
        </div>
      ) : emailUnverified ? (
        <div
          role="status"
          aria-live="polite"
          className="fixed inset-x-0 top-0 z-40 flex items-center gap-3 border-b border-[var(--glass-border)] bg-[var(--glass-bg)] px-4 py-2 backdrop-blur-md lg:hidden"
        >
          <FontAwesomeIcon
            icon={faTriangleExclamation}
            className="size-4 shrink-0 text-amber-400"
            aria-hidden="true"
          />
          <p className="flex-1 text-sm text-amber-200">
            {VERIFICATION_MESSAGES.BANNER_NUDGE}
          </p>
          <Button
            variant="ghost"
            size="sm"
            className="min-h-[44px] shrink-0"
            disabled={isResending}
            onClick={handleResendVerification}
          >
            {isResending ? "Sending..." : "Resend"}
          </Button>
        </div>
      ) : null}

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
            bio: user.bio ?? null,
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
