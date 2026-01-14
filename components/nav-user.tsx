/**
 * User navigation dropdown component for the sidebar.
 * Displays user avatar, account options, and sign-out action.
 */

"use client";

import { useState, useCallback } from "react";
import { LogOut, MoreVertical, Settings } from "lucide-react";
import { signOut } from "next-auth/react";
import { useRouter } from "next/navigation";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { StorageBar, formatBytes } from "@/components/google-drive/storage-bar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from "@/components/ui/sidebar";
import { SettingsDialog } from "@/components/profile";
import { clearSearchCache } from "@/components/search/spotlight-search";
import type { GoogleDriveConnection } from "@/lib/types";

/**
 * Props for NavUser component.
 */
interface NavUserProps {
  /** User data including name, email, and optional avatar */
  user: {
    name: string;
    email: string;
    avatar?: string;
    hasImage?: boolean;
    hasHeroImage?: boolean;
  };
  /** Google Drive connection (null if not connected) */
  driveConnection?: GoogleDriveConnection | null;
}

/**
 * Renders user menu in sidebar footer with dropdown for account actions.
 * Handles sign-out and navigation to account settings.
 *
 * @param user - User data including name, email, and optional avatar
 * @param driveConnection - Google Drive connection or null
 */
export function NavUser({ user, driveConnection }: NavUserProps) {
  const { isMobile } = useSidebar();
  const router = useRouter();
  const [profileDialogOpen, setProfileDialogOpen] = useState(false);

  const handleSignOut = async () => {
    clearSearchCache();
    await signOut({ callbackUrl: "/" });
  };

  const handleProfileChange = useCallback(async () => {
    // Refresh the page to update user data
    router.refresh();
  }, [router]);

  return (
    <SidebarMenu>
      <SidebarMenuItem>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <SidebarMenuButton
              size="lg"
              className="data-[state=open]:bg-sidebar-accent data-[state=open]:text-sidebar-accent-foreground cursor-pointer"
              data-testid="my-items-user-menu"
              suppressHydrationWarning
            >
              <Avatar className="h-8 w-8 rounded-full grayscale">
                <AvatarImage src={user.avatar} alt={user.name} />
                <AvatarFallback className="rounded-full bg-black text-white dark:bg-white dark:text-black">
                  CN
                </AvatarFallback>
              </Avatar>
              <div className="grid flex-1 text-left text-sm leading-tight">
                <span className="truncate font-medium">{user.name}</span>
                <span className="text-muted-foreground truncate text-xs">
                  {user.email}
                </span>
              </div>
              <MoreVertical className="ml-auto size-4" />
            </SidebarMenuButton>
          </DropdownMenuTrigger>
          <DropdownMenuContent
            className="w-(--radix-dropdown-menu-trigger-width) min-w-56 rounded-lg"
            side={isMobile ? "bottom" : "right"}
            align="end"
            sideOffset={4}
          >
            <DropdownMenuLabel className="p-0 font-normal">
              <div className="flex items-center gap-2 px-1 py-1.5 text-left text-sm">
                <Avatar className="h-8 w-8 rounded-full">
                  <AvatarImage src={user.avatar} alt={user.name} />
                  <AvatarFallback className="rounded-full bg-black text-white dark:bg-white dark:text-black">
                    CN
                  </AvatarFallback>
                </Avatar>
                <div className="grid flex-1 text-left text-sm leading-tight">
                  <span className="truncate font-medium">{user.name}</span>
                  <span className="text-muted-foreground truncate text-xs">
                    {user.email}
                  </span>
                </div>
              </div>
            </DropdownMenuLabel>
            {driveConnection && (
              <div className="px-2 py-1.5">
                <StorageBar
                  bytesUsed={driveConnection.quotaBytesUsed}
                  bytesTotal={driveConnection.quotaBytesTotal}
                  variant="compact"
                  className="mb-1"
                />
                <div className="text-muted-foreground text-[10px]">
                  {driveConnection.quotaBytesUsed !== null &&
                  driveConnection.quotaBytesTotal !== null
                    ? `${formatBytes(driveConnection.quotaBytesUsed)} of ${formatBytes(driveConnection.quotaBytesTotal)} used`
                    : "Google Drive"}
                </div>
              </div>
            )}
            <DropdownMenuSeparator />
            <DropdownMenuItem
              onClick={() => setProfileDialogOpen(true)}
              data-testid="my-items-settings-button"
            >
              <Settings />
              Settings
            </DropdownMenuItem>
            <DropdownMenuItem
              onClick={handleSignOut}
              data-testid="my-items-sign-out-button"
            >
              <LogOut />
              Log out
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>

        {/* Settings Dialog */}
        <SettingsDialog
          open={profileDialogOpen}
          onOpenChange={setProfileDialogOpen}
          user={{
            name: user.name || null,
            email: user.email,
            hasImage: user.hasImage ?? false,
            hasHeroImage: user.hasHeroImage ?? false,
          }}
          googleDriveConnection={driveConnection ?? null}
          onProfileChange={handleProfileChange}
        />
      </SidebarMenuItem>
    </SidebarMenu>
  );
}
