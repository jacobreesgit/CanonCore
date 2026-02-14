/**
 * Mobile settings bottom sheet with SwipeableTabs.
 * Mirrors SettingsDialog functionality for mobile viewports.
 * Uses useSettingsForm hook for shared state management.
 * Step-based navigation for password/email/username changes.
 */

"use client";

import { useState, useCallback, useEffect } from "react";
import {
  Loader2,
  Settings,
  Lock,
  Mail,
  Cloud,
  Globe,
  AtSign,
  Check,
  X,
  Upload,
  User,
  ChevronLeft,
  List,
  LogOut,
} from "lucide-react";
import { signOut } from "next-auth/react";
import { toast } from "sonner";
import { clearSearchCache } from "@/components/search/spotlight-search";
import {
  MobileBottomSheet,
  MobileBottomSheetHeader,
  MobileBottomSheetTitle,
  MobileBottomSheetContent,
  MobileBottomSheetFooter,
} from "@/components/mobile/mobile-bottom-sheet";
import {
  SwipeableTabs,
  type SwipeableTab,
} from "@/components/mobile/swipeable-tabs";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { DiscardChangesAlert } from "@/components/mobile/discard-changes-alert";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { FileUpload, FileUploadTrigger } from "@/components/diceui/file-upload";
import { PasswordInput } from "@/components/ui/password-input";
import { Switch } from "@/components/ui/switch";
import {
  GoogleDriveSettingsSection,
  SyncHistory,
} from "@/components/google-drive";
import {
  useSettingsForm,
  type SettingsFormUser,
} from "@/hooks/use-settings-form";
import { cn } from "@/lib/utils";
import type { GoogleDriveConnection } from "@/lib/types";

export interface MobileSettingsSheetProps {
  /** Whether the sheet is open. */
  open: boolean;
  /** Callback when open state changes. */
  onOpenChange: (open: boolean) => void;
  /** Current user profile data. */
  user: SettingsFormUser;
  /** Google Drive connection (null if not connected). */
  googleDriveConnection: GoogleDriveConnection | null;
  /** Callback when profile is updated. */
  onProfileChange?: () => Promise<void>;
}

/**
 * Mobile settings bottom sheet with 5 swipeable tabs.
 * Supports step takeover for password/email/username changes.
 *
 * @param open - Whether the sheet is visible
 * @param onOpenChange - Callback for visibility changes
 * @param user - Current user profile data
 * @param googleDriveConnection - Drive connection or null
 * @param onProfileChange - Callback when settings are saved
 */
export function MobileSettingsSheet({
  open,
  onOpenChange,
  user,
  googleDriveConnection,
  onProfileChange,
}: MobileSettingsSheetProps) {
  const form = useSettingsForm(
    user,
    googleDriveConnection,
    onProfileChange,
    () => onOpenChange(false)
  );

  const [activeTab, setActiveTab] = useState("profile");
  const [showDiscardAlert, setShowDiscardAlert] = useState(false);

  // Reset form when sheet opens
  useEffect(() => {
    if (open) {
      form.resetForm();
      setActiveTab("profile");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- only reset on open change
  }, [open]);

  /**
   * Handles dismiss with dirty state check.
   */
  const handleOpenChange = useCallback(
    (newOpen: boolean) => {
      if (!newOpen && form.isDirty) {
        setShowDiscardAlert(true);
        return;
      }
      onOpenChange(newOpen);
    },
    [form.isDirty, onOpenChange]
  );

  const { handleMainCancel } = form;

  /**
   * Handles discard confirmation.
   */
  const handleDiscard = useCallback(() => {
    setShowDiscardAlert(false);
    handleMainCancel();
  }, [handleMainCancel]);

  // -------------------------------------------------------------------------
  // Discard alert helper
  // -------------------------------------------------------------------------

  const discardAlert = (
    <DiscardChangesAlert
      open={showDiscardAlert}
      onOpenChange={setShowDiscardAlert}
      onDiscard={handleDiscard}
    />
  );

  // -------------------------------------------------------------------------
  // Public confirm alert
  // -------------------------------------------------------------------------

  function renderPublicConfirmAlert() {
    return (
      <AlertDialog
        open={form.showPublicConfirm}
        onOpenChange={form.setShowPublicConfirm}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <Globe aria-hidden="true" className="text-brand h-5 w-5" />
              Make your profile public?
            </AlertDialogTitle>
            <AlertDialogDescription className="space-y-3">
              <p>
                When you enable a public profile, the following will be visible
                to anyone on the internet:
              </p>
              <ul className="list-inside list-disc space-y-1 text-sm">
                <li>Your display name and username</li>
                <li>Your profile picture and hero banner</li>
                <li>Any items you mark as public</li>
                <li>When you joined</li>
              </ul>
              <p className="text-muted-foreground">
                You can change this setting at any time.
              </p>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Keep Private</AlertDialogCancel>
            <AlertDialogAction onClick={form.handlePublicConfirm}>
              Make Public
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    );
  }

  // -------------------------------------------------------------------------
  // Step-specific sheets (password, email, username)
  // -------------------------------------------------------------------------

  if (form.currentStep === "password") {
    return (
      <>
        <MobileBottomSheet
          open={open}
          onOpenChange={onOpenChange}
          snapPoints={[0.85]}
          repositionInputs
          title="Change Password"
          description="Enter your current password and choose a new one"
          className={cn(
            "bg-[#1a1a1a]/95 backdrop-blur-xl",
            "border-t border-white/[0.08]",
            "text-foreground"
          )}
        >
          <MobileBottomSheetHeader className="border-b border-white/[0.08] pb-4">
            <div className="flex items-center gap-3">
              <Button
                variant="ghost"
                size="icon"
                onClick={form.handleBack}
                disabled={form.isPasswordSaving}
                className="hover:bg-muted/50 size-10 transition-all active:scale-95"
                aria-label="Back"
              >
                <ChevronLeft aria-hidden="true" className="size-5" />
              </Button>
              <div
                className={cn(
                  "flex size-10 shrink-0 items-center justify-center rounded-xl",
                  "bg-primary/10 ring-primary/20 ring-1"
                )}
              >
                <Lock aria-hidden="true" className="text-primary size-5" />
              </div>
              <div className="min-w-0 flex-1">
                <MobileBottomSheetTitle>Change Password</MobileBottomSheetTitle>
                <p className="text-muted-foreground text-sm">
                  Enter current and new password
                </p>
              </div>
            </div>
          </MobileBottomSheetHeader>

          <MobileBottomSheetContent>
            <div
              className="space-y-4 py-2"
              onKeyDown={(e) => {
                if (e.key === "Enter" && !form.isPasswordSaving) {
                  e.preventDefault();
                  form.handlePasswordSubmit();
                }
              }}
            >
              <div className="space-y-2">
                <Label htmlFor="mobile-current-password">
                  Current Password
                </Label>
                <PasswordInput
                  id="mobile-current-password"
                  name="current-password"
                  autoComplete="current-password"
                  value={form.currentPassword}
                  onChange={(e) => form.setCurrentPassword(e.target.value)}
                  placeholder="Enter current password"
                  className="h-10"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="mobile-new-password">New Password</Label>
                <PasswordInput
                  id="mobile-new-password"
                  name="new-password"
                  autoComplete="new-password"
                  value={form.newPassword}
                  onChange={(e) => form.setNewPassword(e.target.value)}
                  placeholder="Enter new password"
                  className="h-10"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="mobile-confirm-password">
                  Confirm New Password
                </Label>
                <PasswordInput
                  id="mobile-confirm-password"
                  name="confirm-password"
                  autoComplete="new-password"
                  value={form.confirmPassword}
                  onChange={(e) => form.setConfirmPassword(e.target.value)}
                  placeholder="Repeat new password"
                  className="h-10"
                />
              </div>
              <p className="text-muted-foreground text-xs">
                8+ characters with uppercase, lowercase, and number.
              </p>
            </div>
          </MobileBottomSheetContent>

          <MobileBottomSheetFooter className="pb-[calc(1rem+env(safe-area-inset-bottom))]">
            <div className="flex gap-3">
              <Button
                variant="outline"
                onClick={form.handleBack}
                disabled={form.isPasswordSaving}
                className="flex-1"
              >
                Cancel
              </Button>
              <Button
                onClick={form.handlePasswordSubmit}
                disabled={form.isPasswordSaving}
                className="flex-1"
              >
                {form.isPasswordSaving ? (
                  <>
                    <Loader2
                      aria-hidden="true"
                      className="size-4 animate-spin"
                    />
                    Changing…
                  </>
                ) : (
                  "Change Password"
                )}
              </Button>
            </div>
          </MobileBottomSheetFooter>
        </MobileBottomSheet>
        {discardAlert}
      </>
    );
  }

  if (form.currentStep === "email") {
    return (
      <>
        <MobileBottomSheet
          open={open}
          onOpenChange={onOpenChange}
          snapPoints={[0.85]}
          repositionInputs
          title="Change Email"
          description="Enter your new email and verify with your password"
          className={cn(
            "bg-[#1a1a1a]/95 backdrop-blur-xl",
            "border-t border-white/[0.08]",
            "text-foreground"
          )}
        >
          <MobileBottomSheetHeader className="border-b border-white/[0.08] pb-4">
            <div className="flex items-center gap-3">
              <Button
                variant="ghost"
                size="icon"
                onClick={form.handleBack}
                disabled={form.isEmailSaving}
                className="hover:bg-muted/50 size-10 transition-all active:scale-95"
                aria-label="Back"
              >
                <ChevronLeft aria-hidden="true" className="size-5" />
              </Button>
              <div
                className={cn(
                  "flex size-10 shrink-0 items-center justify-center rounded-xl",
                  "bg-primary/10 ring-primary/20 ring-1"
                )}
              >
                <Mail aria-hidden="true" className="text-primary size-5" />
              </div>
              <div className="min-w-0 flex-1">
                <MobileBottomSheetTitle>Change Email</MobileBottomSheetTitle>
                <p className="text-muted-foreground text-sm">
                  Verify with your password
                </p>
              </div>
            </div>
          </MobileBottomSheetHeader>

          <MobileBottomSheetContent>
            <div
              className="space-y-4 py-2"
              onKeyDown={(e) => {
                if (e.key === "Enter" && !form.isEmailSaving) {
                  e.preventDefault();
                  form.handleEmailSubmit();
                }
              }}
            >
              <div className="space-y-2">
                <Label htmlFor="mobile-new-email">New Email</Label>
                <Input
                  id="mobile-new-email"
                  name="email"
                  type="email"
                  autoComplete="email"
                  spellCheck={false}
                  value={form.newEmail}
                  onChange={(e) => form.setNewEmail(e.target.value)}
                  placeholder="Enter new email address"
                  className="h-10"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="mobile-email-password">Current Password</Label>
                <PasswordInput
                  id="mobile-email-password"
                  name="current-password"
                  autoComplete="current-password"
                  value={form.emailPassword}
                  onChange={(e) => form.setEmailPassword(e.target.value)}
                  placeholder="Verify with your password"
                  className="h-10"
                />
                <p className="text-muted-foreground text-xs">
                  Password required to confirm this change.
                </p>
              </div>
            </div>
          </MobileBottomSheetContent>

          <MobileBottomSheetFooter className="pb-[calc(1rem+env(safe-area-inset-bottom))]">
            <div className="flex gap-3">
              <Button
                variant="outline"
                onClick={form.handleBack}
                disabled={form.isEmailSaving}
                className="flex-1"
              >
                Cancel
              </Button>
              <Button
                onClick={form.handleEmailSubmit}
                disabled={form.isEmailSaving}
                className="flex-1"
              >
                {form.isEmailSaving ? (
                  <>
                    <Loader2
                      aria-hidden="true"
                      className="size-4 animate-spin"
                    />
                    Changing…
                  </>
                ) : (
                  "Change Email"
                )}
              </Button>
            </div>
          </MobileBottomSheetFooter>
        </MobileBottomSheet>
        {discardAlert}
      </>
    );
  }

  if (form.currentStep === "username") {
    return (
      <>
        <MobileBottomSheet
          open={open}
          onOpenChange={onOpenChange}
          snapPoints={[0.85]}
          repositionInputs
          title="Change Username"
          description="Enter your new username and verify with your password"
          className={cn(
            "bg-[#1a1a1a]/95 backdrop-blur-xl",
            "border-t border-white/[0.08]",
            "text-foreground"
          )}
        >
          <MobileBottomSheetHeader className="border-b border-white/[0.08] pb-4">
            <div className="flex items-center gap-3">
              <Button
                variant="ghost"
                size="icon"
                onClick={form.handleBack}
                disabled={form.isUsernameSaving}
                className="hover:bg-muted/50 size-10 transition-all active:scale-95"
                aria-label="Back"
              >
                <ChevronLeft aria-hidden="true" className="size-5" />
              </Button>
              <div
                className={cn(
                  "flex size-10 shrink-0 items-center justify-center rounded-xl",
                  "bg-primary/10 ring-primary/20 ring-1"
                )}
              >
                <AtSign aria-hidden="true" className="text-primary size-5" />
              </div>
              <div className="min-w-0 flex-1">
                <MobileBottomSheetTitle>Change Username</MobileBottomSheetTitle>
                <p className="text-muted-foreground text-sm">
                  Verify with your password
                </p>
              </div>
            </div>
          </MobileBottomSheetHeader>

          <MobileBottomSheetContent>
            <div
              className="space-y-4 py-2"
              onKeyDown={(e) => {
                if (e.key === "Enter" && !form.isUsernameSaving) {
                  e.preventDefault();
                  form.handleUsernameSubmit();
                }
              }}
            >
              <div className="space-y-2">
                <Label htmlFor="mobile-new-username">New Username</Label>
                <div className="relative">
                  <Input
                    id="mobile-new-username"
                    name="username"
                    autoComplete="username"
                    spellCheck={false}
                    value={form.newUsername}
                    onChange={(e) =>
                      form.setNewUsername(
                        e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, "")
                      )
                    }
                    placeholder="Enter new username"
                    className={cn(
                      "h-10 pr-10",
                      form.newUsername &&
                        form.usernameValidation.isValidFormat &&
                        form.usernameValidation.isAvailable === true &&
                        "border-green-500 focus-visible:ring-green-500/20",
                      form.newUsername &&
                        (form.usernameValidation.error ||
                          form.usernameValidation.isAvailable === false) &&
                        "border-destructive focus-visible:ring-destructive/20"
                    )}
                  />
                  {form.newUsername && (
                    <div className="absolute top-1/2 right-3 -translate-y-1/2">
                      {form.usernameValidation.isValidating ? (
                        <Loader2
                          aria-hidden="true"
                          className="text-muted-foreground size-4 animate-spin"
                        />
                      ) : form.usernameValidation.isValidFormat &&
                        form.usernameValidation.isAvailable === true ? (
                        <Check
                          aria-hidden="true"
                          className="size-4 text-green-500"
                        />
                      ) : form.usernameValidation.error ||
                        form.usernameValidation.isAvailable === false ? (
                        <X
                          aria-hidden="true"
                          className="text-destructive size-4"
                        />
                      ) : null}
                    </div>
                  )}
                </div>
                {form.newUsername && form.usernameValidation.error && (
                  <p role="alert" className="text-destructive text-xs">
                    {form.usernameValidation.error}
                  </p>
                )}
                {form.newUsername &&
                  form.usernameValidation.isAvailable === false &&
                  !form.usernameValidation.error && (
                    <p role="alert" className="text-destructive text-xs">
                      Username is already taken
                    </p>
                  )}
                {form.newUsername &&
                  form.usernameValidation.isValidFormat &&
                  form.usernameValidation.isAvailable === true && (
                    <p className="text-xs text-green-500">
                      Username is available
                    </p>
                  )}
                <p className="text-muted-foreground text-xs">
                  3-20 characters. Lowercase letters, numbers, and underscores
                  only.
                </p>
              </div>
              <div className="space-y-2">
                <Label htmlFor="mobile-username-password">
                  Current Password
                </Label>
                <PasswordInput
                  id="mobile-username-password"
                  name="current-password"
                  autoComplete="current-password"
                  value={form.usernamePassword}
                  onChange={(e) => form.setUsernamePassword(e.target.value)}
                  placeholder="Verify with your password"
                  className="h-10"
                />
                <p className="text-muted-foreground text-xs">
                  Password required to confirm this change.
                </p>
              </div>
            </div>
          </MobileBottomSheetContent>

          <MobileBottomSheetFooter className="pb-[calc(1rem+env(safe-area-inset-bottom))]">
            <div className="flex gap-3">
              <Button
                variant="outline"
                onClick={form.handleBack}
                disabled={form.isUsernameSaving}
                className="flex-1"
              >
                Cancel
              </Button>
              <Button
                onClick={form.handleUsernameSubmit}
                disabled={form.isUsernameSaving}
                className="flex-1"
              >
                {form.isUsernameSaving ? (
                  <>
                    <Loader2
                      aria-hidden="true"
                      className="size-4 animate-spin"
                    />
                    Changing…
                  </>
                ) : (
                  "Change Username"
                )}
              </Button>
            </div>
          </MobileBottomSheetFooter>
        </MobileBottomSheet>
        {discardAlert}
      </>
    );
  }

  // -------------------------------------------------------------------------
  // Tab content
  // -------------------------------------------------------------------------

  const profileContent = (
    <div className="space-y-6">
      {/* Avatar + Hero section */}
      <div className="space-y-4">
        {/* Hero image upload */}
        <FileUpload
          value={form.heroImage ? [form.heroImage] : []}
          onValueChange={(files) => {
            if (files.length > 0) {
              form.handleHeroImageDrop(files);
            }
          }}
          accept="image/*"
          maxFiles={1}
          maxSize={5 * 1024 * 1024}
        >
          <div
            data-testid="hero-dropzone"
            className="bg-muted relative h-28 overflow-hidden rounded-lg bg-cover bg-center"
            style={{
              backgroundImage: form.heroImageSrc
                ? `url(${form.heroImageSrc})`
                : undefined,
            }}
          >
            <div className="absolute inset-0 bg-black/20" />
            <div className="absolute right-2 bottom-2 flex gap-2">
              <FileUploadTrigger asChild>
                <Button size="sm" variant="secondary" className="shadow-md">
                  <Upload className="mr-1.5 size-3.5" />
                  Change Cover
                </Button>
              </FileUploadTrigger>
              {(form.heroImage || (user.hasHeroImage && !form.removeHero)) && (
                <Button
                  size="icon"
                  variant="secondary"
                  className="size-7 shadow-md"
                  aria-label="Remove cover"
                  onClick={form.handleRemoveHeroImage}
                >
                  <X className="size-3.5" />
                </Button>
              )}
            </div>
          </div>
        </FileUpload>

        {/* Avatar upload */}
        <div className="flex items-center gap-4">
          <FileUpload
            value={form.profileImage ? [form.profileImage] : []}
            onValueChange={(files) => {
              if (files.length > 0) {
                form.handleProfileImageDrop(files);
              }
            }}
            accept="image/*"
            maxFiles={1}
            maxSize={2 * 1024 * 1024}
          >
            <div className="relative" data-testid="profile-dropzone">
              <Avatar className="size-16 border-2 border-white/10 shadow-lg">
                <AvatarImage
                  src={form.profileImageSrc || undefined}
                  alt={form.name || "Profile"}
                  className="object-cover"
                />
                <AvatarFallback className="text-lg font-semibold">
                  {form.name
                    ?.split(" ")
                    .map((n) => n[0])
                    .join("")
                    .toUpperCase()
                    .slice(0, 2) || (
                    <User
                      aria-hidden="true"
                      className="text-muted-foreground size-7"
                    />
                  )}
                </AvatarFallback>
              </Avatar>
              <FileUploadTrigger asChild>
                <Button
                  size="icon"
                  variant="secondary"
                  className="absolute -right-1 -bottom-1 size-7 rounded-full shadow-md"
                  aria-label="Upload avatar"
                >
                  <Upload className="size-3.5" />
                </Button>
              </FileUploadTrigger>
            </div>
          </FileUpload>
          <div className="min-w-0 flex-1 space-y-1">
            {user.hasImage && !form.removeProfile && (
              <Button
                variant="ghost"
                size="sm"
                onClick={form.handleRemoveProfileImage}
                className="text-muted-foreground h-7 text-xs"
              >
                Remove Avatar
              </Button>
            )}
          </div>
        </div>
      </div>

      {/* Display Name */}
      <div className="space-y-2">
        <Label htmlFor="mobile-settings-name">Display Name</Label>
        <Input
          id="mobile-settings-name"
          name="name"
          autoComplete="name"
          value={form.name}
          onChange={(e) => form.setName(e.target.value)}
          placeholder="Your name"
        />
      </div>

      {/* Public toggle */}
      <div className="space-y-3">
        <div className="flex items-center justify-between rounded-lg border border-white/[0.08] p-4">
          <div className="flex items-center gap-3">
            <div
              className={cn(
                "flex size-9 items-center justify-center rounded-lg",
                form.isPublic ? "bg-green-500/10" : "bg-muted"
              )}
            >
              <Globe
                aria-hidden="true"
                className={cn(
                  "size-4",
                  form.isPublic ? "text-green-500" : "text-muted-foreground"
                )}
              />
            </div>
            <div className="space-y-0.5">
              <Label
                htmlFor="mobile-settings-public"
                className="text-sm font-medium"
              >
                Public Profile
              </Label>
              <p className="text-muted-foreground text-xs">
                {form.isPublic
                  ? "Visible to anyone"
                  : "Your profile is private"}
              </p>
            </div>
          </div>
          <Switch
            id="mobile-settings-public"
            data-testid="settings-public-toggle"
            checked={form.isPublic}
            onCheckedChange={form.handlePublicToggle}
          />
        </div>
      </div>
    </div>
  );

  const accountContent = (
    <div className="space-y-4">
      {/* Username */}
      <div className="flex items-center justify-between rounded-lg border border-white/[0.08] p-4">
        <div className="min-w-0 flex-1 space-y-0.5">
          <p className="text-sm font-medium">Username</p>
          <p className="text-muted-foreground truncate text-xs">
            {user.username ? `@${user.username}` : "No username set"}
          </p>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={() => form.setCurrentStep("username")}
        >
          Change
        </Button>
      </div>

      {/* Email */}
      <div className="flex items-center justify-between rounded-lg border border-white/[0.08] p-4">
        <div className="min-w-0 flex-1 space-y-0.5">
          <p className="text-sm font-medium">Email</p>
          <p className="text-muted-foreground truncate text-xs">{user.email}</p>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={() => form.setCurrentStep("email")}
        >
          Change Email
        </Button>
      </div>

      {/* Password */}
      <Button
        variant="outline"
        onClick={() => form.setCurrentStep("password")}
        className="w-full justify-start gap-2"
      >
        <Lock aria-hidden="true" className="size-4" />
        Change Password
      </Button>

      {/* Sign Out */}
      <Button
        variant="outline"
        onClick={async () => {
          try {
            clearSearchCache();
            await signOut({ callbackUrl: "/" });
          } catch {
            toast.error("Failed to sign out", {
              description: "Please try again.",
            });
          }
        }}
        className="w-full justify-start gap-2"
      >
        <LogOut aria-hidden="true" className="size-4" />
        Sign out
      </Button>
    </div>
  );

  const connectionsContent = (
    <div className="space-y-4">
      <GoogleDriveSettingsSection
        connection={googleDriveConnection}
        onConnectionChange={onProfileChange}
      />
    </div>
  );

  const activityContent = googleDriveConnection ? (
    <div className="space-y-4">
      <SyncHistory />
    </div>
  ) : (
    <div className="space-y-4 py-8 text-center">
      <div className="bg-muted/50 mx-auto flex size-12 items-center justify-center rounded-full">
        <Cloud aria-hidden="true" className="text-muted-foreground size-6" />
      </div>
      <div className="space-y-1">
        <p className="text-sm font-medium">No sync activity</p>
        <p className="text-muted-foreground text-sm">
          Connect Google Drive to track sync history
        </p>
      </div>
    </div>
  );

  const tabs: SwipeableTab[] = [
    { id: "profile", label: "Profile", icon: User, content: profileContent },
    { id: "account", label: "Account", icon: Lock, content: accountContent },
    {
      id: "connections",
      label: "Connections",
      icon: Cloud,
      content: connectionsContent,
    },
    { id: "activity", label: "Activity", icon: List, content: activityContent },
  ];

  // -------------------------------------------------------------------------
  // Main view
  // -------------------------------------------------------------------------

  return (
    <>
      <MobileBottomSheet
        open={open}
        onOpenChange={handleOpenChange}
        snapPoints={[0.85]}
        repositionInputs
        swipeable
        title="Settings"
        description="Manage your account and connections"
        data-testid="settings-dialog"
        className={cn(
          "bg-[#1a1a1a]/95 backdrop-blur-xl",
          "border-t border-white/[0.08]",
          "text-foreground"
        )}
      >
        <MobileBottomSheetHeader className="border-b border-white/[0.08] pb-4">
          <div className="flex items-center gap-3">
            <div
              className={cn(
                "flex size-10 shrink-0 items-center justify-center rounded-xl",
                "bg-primary/10 ring-primary/20 ring-1"
              )}
            >
              <Settings aria-hidden="true" className="text-primary size-5" />
            </div>
            <div className="min-w-0">
              <MobileBottomSheetTitle>Settings</MobileBottomSheetTitle>
              <p className="text-muted-foreground text-sm">
                Manage your account
              </p>
            </div>
          </div>
        </MobileBottomSheetHeader>

        <MobileBottomSheetContent className="flex flex-col overflow-hidden pb-0">
          <SwipeableTabs
            tabs={tabs}
            activeTab={activeTab}
            onTabChange={setActiveTab}
            ariaLabel="Settings tabs"
          />
        </MobileBottomSheetContent>

        {/* Footer - always visible, save disabled when not dirty */}
        <MobileBottomSheetFooter className="pb-[calc(1rem+env(safe-area-inset-bottom))]">
          <div className="flex gap-3">
            <Button
              variant="outline"
              onClick={form.handleMainCancel}
              disabled={form.isMainSaving}
              className="flex-1"
            >
              Cancel
            </Button>
            <Button
              onClick={form.handleMainSave}
              disabled={!form.isDirty || form.isMainSaving}
              className="flex-1"
              aria-busy={form.isMainSaving}
            >
              {form.isMainSaving ? (
                <>
                  <Loader2 aria-hidden="true" className="size-4 animate-spin" />
                  Saving…
                </>
              ) : (
                "Save Changes"
              )}
            </Button>
          </div>
        </MobileBottomSheetFooter>
      </MobileBottomSheet>

      {discardAlert}
      {renderPublicConfirmAlert()}
    </>
  );
}

export default MobileSettingsSheet;
