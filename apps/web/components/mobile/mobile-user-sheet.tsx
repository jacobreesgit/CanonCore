/**
 * Mobile user account bottom sheet component.
 * Displays user info, Google Drive storage, and account actions.
 */

"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faGear,
  faMoon,
  faRightFromBracket,
  faSun,
} from "@fortawesome/free-solid-svg-icons";
import { useTheme } from "next-themes";
import { signOut } from "next-auth/react";
import { toast } from "sonner";
import { MobileBottomSheet } from "./mobile-bottom-sheet";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { StorageBar, formatBytes } from "@/components/google-drive/storage-bar";
import { MobileSettingsSheet } from "@/components/profile/mobile-settings-sheet";
import { clearSearchCache } from "@/components/search/spotlight-search";
import type { GoogleDriveConnection } from "@/lib/types";

/**
 * Props for MobileUserSheet component.
 */
export interface MobileUserSheetProps {
  /** Whether the sheet is open */
  open: boolean;
  /** Callback when open state changes */
  onOpenChange: (open: boolean) => void;
  /** User data */
  user: {
    name: string;
    email: string;
    avatar?: string;
    username?: string | null;
    isPublic?: boolean;
    hasImage?: boolean;
    hasHeroImage?: boolean;
    bio?: string | null;
  };
  /** Google Drive connection (null if not connected) */
  driveConnection?: GoogleDriveConnection | null;
}

/**
 * Mobile user account bottom sheet.
 * Displays:
 * - User info header (avatar, name, email)
 * - Google Drive storage bar (if connected)
 * - Settings button (opens SettingsDialog)
 * - Sign out button
 *
 * @param open - Whether the sheet is open
 * @param onOpenChange - Callback when open state changes
 * @param user - User data
 * @param driveConnection - Google Drive connection or null
 */
export function MobileUserSheet({
  open,
  onOpenChange,
  user,
  driveConnection,
}: MobileUserSheetProps) {
  const router = useRouter();
  const { theme, setTheme } = useTheme();
  const [settingsOpen, setSettingsOpen] = React.useState(false);
  const [isSigningOut, setIsSigningOut] = React.useState(false);

  const toggleTheme = React.useCallback(() => {
    setTheme(theme === "dark" ? "light" : "dark");
  }, [theme, setTheme]);

  const handleSignOut = React.useCallback(async () => {
    try {
      setIsSigningOut(true);
      clearSearchCache();
      await signOut({ callbackUrl: "/" });
    } catch {
      toast.error("Failed to sign out", {
        description: "Please try again.",
      });
      setIsSigningOut(false);
    }
  }, []);

  const handleOpenSettings = React.useCallback(() => {
    setSettingsOpen(true);
  }, []);

  const handleProfileChange = React.useCallback(async () => {
    router.refresh();
  }, [router]);

  return (
    <>
      <MobileBottomSheet
        open={open}
        onOpenChange={onOpenChange}
        snapPoints={["auto"]}
        title="Account"
        description="Manage your account settings"
      >
        <div className="px-4 pt-2 pb-6">
          {/* User info header */}
          <div className="flex items-center gap-3 py-3">
            <Avatar className="size-12 rounded-full">
              <AvatarImage src={user.avatar} alt={user.name} />
              <AvatarFallback className="bg-primary text-primary-foreground rounded-full text-sm font-medium">
                {user.name?.charAt(0)?.toUpperCase() || "U"}
              </AvatarFallback>
            </Avatar>
            <div className="min-w-0 flex-1">
              <p className="truncate font-semibold">{user.name}</p>
              <p className="text-muted-foreground truncate text-sm">
                {user.email}
              </p>
            </div>
          </div>

          {/* Google Drive storage (if connected) */}
          {driveConnection && (
            <>
              <Separator className="my-3" />
              <div className="py-2">
                <p className="text-muted-foreground mb-2 text-xs font-medium tracking-wider uppercase">
                  Google Drive
                </p>
                <StorageBar
                  bytesUsed={driveConnection.quotaBytesUsed}
                  bytesTotal={driveConnection.quotaBytesTotal}
                  variant="default"
                />
                {driveConnection.quotaBytesUsed !== null &&
                  driveConnection.quotaBytesTotal !== null && (
                    <p className="text-muted-foreground mt-1.5 text-xs">
                      {formatBytes(driveConnection.quotaBytesUsed)} of{" "}
                      {formatBytes(driveConnection.quotaBytesTotal)} used
                    </p>
                  )}
              </div>
            </>
          )}

          <Separator className="my-3" />

          {/* Actions */}
          <div className="flex flex-col gap-2 pt-1">
            <Button
              variant="outline"
              className="w-full justify-start gap-2"
              onClick={toggleTheme}
            >
              {theme === "dark" ? (
                <FontAwesomeIcon
                  icon={faSun}
                  className="size-4"
                  aria-hidden="true"
                />
              ) : (
                <FontAwesomeIcon
                  icon={faMoon}
                  className="size-4"
                  aria-hidden="true"
                />
              )}
              {theme === "dark" ? "Light Mode" : "Dark Mode"}
            </Button>

            <Button
              variant="outline"
              className="w-full justify-start gap-2"
              onClick={handleOpenSettings}
            >
              <FontAwesomeIcon
                icon={faGear}
                className="size-4"
                aria-hidden="true"
              />
              Settings
            </Button>

            <Button
              variant="outline"
              className="w-full justify-start gap-2"
              onClick={handleSignOut}
              disabled={isSigningOut}
            >
              <FontAwesomeIcon
                icon={faRightFromBracket}
                className="size-4"
                aria-hidden="true"
              />
              {isSigningOut ? "Signing out…" : "Sign out"}
            </Button>
          </div>
        </div>
      </MobileBottomSheet>

      {/* Mobile Settings Sheet */}
      <MobileSettingsSheet
        open={settingsOpen}
        onOpenChange={setSettingsOpen}
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
        onProfileChange={handleProfileChange}
      />
    </>
  );
}
