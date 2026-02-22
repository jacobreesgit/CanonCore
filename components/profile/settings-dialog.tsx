/**
 * Settings dialog with profile and Google Drive settings.
 * Handles name, email, password changes, image uploads, and Drive connection.
 * Uses step-based navigation for password/email changes instead of stacked modals.
 */

"use client";

import { useState, useCallback, useEffect, useMemo } from "react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faAt,
  faCheck,
  faChevronLeft,
  faCloud,
  faEnvelope,
  faGear,
  faGlobe,
  faLock,
  faSpinner,
  faUpload,
  faUser,
  faXmark,
  faDownload,
  faTrash,
} from "@fortawesome/free-solid-svg-icons";
import { Dialog } from "@/components/ui/dialog";
import { AnimatedDialogContent } from "@/components/ui/animated-dialog-content";
import {
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
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
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { FileUpload, FileUploadTrigger } from "@/components/diceui/file-upload";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { PasswordInput } from "@/components/ui/password-input";
import { Switch } from "@/components/ui/switch";
import { useUsernameValidation } from "@/hooks/use-username-validation";
import {
  updateProfile,
  uploadProfileImage,
  uploadHeroImage,
  removeProfileImage,
  removeHeroImage,
  changePassword,
  deleteAccount,
  exportAccountData,
} from "@/lib/user-actions";
import { signOut } from "next-auth/react";
import { passwordSchema, emailSchema } from "@/lib/validations";
import {
  GoogleDriveSettingsSection,
  SyncHistory,
} from "@/components/google-drive";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { SETTINGS_MESSAGES } from "@/lib/constants/messages";
import type { GoogleDriveConnection } from "@/lib/types";

/** Steps for settings dialog navigation. */
type SettingsStep =
  | "main"
  | "password"
  | "email"
  | "username"
  | "delete-account";

/** Available settings tabs */
type SettingsTab = "profile" | "account" | "connections" | "activity";

interface SettingsDialogProps {
  /** Whether the dialog is open */
  open: boolean;
  /** Callback when dialog open state changes */
  onOpenChange: (open: boolean) => void;
  /** Current user profile data */
  user: {
    name: string | null;
    email: string;
    username: string | null;
    isPublic: boolean;
    hasImage: boolean;
    hasHeroImage: boolean;
  };
  /** Google Drive connection (null if not connected) */
  googleDriveConnection: GoogleDriveConnection | null;
  /** Callback when profile is updated */
  onProfileChange?: () => Promise<void>;
  /** Default tab to show (for Storybook) */
  defaultTab?: SettingsTab;
}

// ============================================================================
// Settings Dialog Component
// ============================================================================

/**
 * Settings dialog with profile and Google Drive sections.
 * Uses step-based navigation for password/email changes.
 * Uses slot-based AnimatedDialogContent for sticky headers/footers.
 *
 * @param open - Whether dialog is visible
 * @param onOpenChange - Callback for visibility changes
 * @param user - Current user profile data
 * @param googleDriveConnection - Drive connection or null
 * @param onProfileChange - Callback when settings are saved
 */
export function SettingsDialog({
  open,
  onOpenChange,
  user,
  googleDriveConnection,
  onProfileChange,
  defaultTab = "profile",
}: SettingsDialogProps) {
  const [currentStep, setCurrentStep] = useState<SettingsStep>("main");

  // Password step state
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [isPasswordSaving, setIsPasswordSaving] = useState(false);

  // Email step state
  const [newEmail, setNewEmail] = useState(user.email);
  const [emailPassword, setEmailPassword] = useState("");
  const [isEmailSaving, setIsEmailSaving] = useState(false);

  // Username step state
  const [newUsername, setNewUsername] = useState(user.username ?? "");
  const [usernamePassword, setUsernamePassword] = useState("");
  const [isUsernameSaving, setIsUsernameSaving] = useState(false);

  // Delete account state
  const [deletePassword, setDeletePassword] = useState("");
  const [deleteConfirmText, setDeleteConfirmText] = useState("");
  const [isDeleting, setIsDeleting] = useState(false);

  // Data export state
  const [isExporting, setIsExporting] = useState(false);

  // Main step state
  const [name, setName] = useState(user.name ?? "");
  const [isPublic, setIsPublic] = useState(user.isPublic);
  const [profileImage, setProfileImage] = useState<File | null>(null);
  const [heroImage, setHeroImage] = useState<File | null>(null);
  const [showPublicConfirm, setShowPublicConfirm] = useState(false);

  // Username validation (for username change modal)
  const usernameValidation = useUsernameValidation(newUsername, user.username);
  const [profileImagePreview, setProfileImagePreview] = useState<string | null>(
    null
  );
  const [heroImagePreview, setHeroImagePreview] = useState<string | null>(null);
  const [removeProfile, setRemoveProfile] = useState(false);
  const [removeHero, setRemoveHero] = useState(false);
  const [isMainSaving, setIsMainSaving] = useState(false);

  // Original values for dirty checking
  const originalValues = useMemo(
    () => ({
      name: user.name ?? "",
      isPublic: user.isPublic,
    }),
    [user.name, user.isPublic]
  );

  // Dirty state detection for main step
  const isDirty = useMemo(() => {
    const nameChanged = name !== originalValues.name;
    const isPublicChanged = isPublic !== originalValues.isPublic;
    const profileImageChanging = profileImage !== null || removeProfile;
    const heroImageChanging = heroImage !== null || removeHero;
    return (
      nameChanged ||
      isPublicChanged ||
      profileImageChanging ||
      heroImageChanging
    );
  }, [
    name,
    isPublic,
    profileImage,
    heroImage,
    removeProfile,
    removeHero,
    originalValues,
  ]);

  // Reset all state when dialog opens
  useEffect(() => {
    if (open) {
      setCurrentStep("main");
      // Reset password state
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
      setIsPasswordSaving(false);
      // Reset email state
      setNewEmail(user.email);
      setEmailPassword("");
      setIsEmailSaving(false);
      // Reset username state
      setNewUsername(user.username ?? "");
      setUsernamePassword("");
      setIsUsernameSaving(false);
      // Reset main state
      setName(user.name ?? "");
      setIsPublic(user.isPublic);
      setProfileImage(null);
      setHeroImage(null);
      setProfileImagePreview(null);
      setHeroImagePreview(null);
      setRemoveProfile(false);
      setRemoveHero(false);
      setIsMainSaving(false);
      // Reset delete account state
      setDeletePassword("");
      setDeleteConfirmText("");
      setIsDeleting(false);
      setIsExporting(false);
    }
  }, [open, user.name, user.email, user.username, user.isPublic]);

  // Cleanup preview URLs on unmount
  useEffect(() => {
    return () => {
      if (profileImagePreview) URL.revokeObjectURL(profileImagePreview);
      if (heroImagePreview) URL.revokeObjectURL(heroImagePreview);
    };
  }, [profileImagePreview, heroImagePreview]);

  const handleBack = useCallback(() => {
    setCurrentStep("main");
    setDeletePassword("");
    setDeleteConfirmText("");
  }, []);

  // Password handlers
  const handlePasswordSubmit = useCallback(async () => {
    if (!currentPassword || !newPassword || !confirmPassword) {
      toast.error("All fields are required");
      return;
    }

    if (newPassword !== confirmPassword) {
      toast.error("New passwords do not match");
      return;
    }

    const validation = passwordSchema.safeParse(newPassword);
    if (!validation.success) {
      toast.error(validation.error.issues[0].message);
      return;
    }

    setIsPasswordSaving(true);
    try {
      const result = await changePassword({ currentPassword, newPassword });

      if (result.success) {
        toast.success(SETTINGS_MESSAGES.PASSWORD_SAVED);
        setCurrentStep("main");
        setCurrentPassword("");
        setNewPassword("");
        setConfirmPassword("");
      } else {
        toast.error(result.error);
      }
    } catch {
      toast.error("Failed to change password");
    } finally {
      setIsPasswordSaving(false);
    }
  }, [currentPassword, newPassword, confirmPassword]);

  // Email handlers
  const handleEmailSubmit = useCallback(async () => {
    if (!newEmail || !emailPassword) {
      toast.error("All fields are required");
      return;
    }

    const validation = emailSchema.safeParse(newEmail);
    if (!validation.success) {
      toast.error("Invalid email format");
      return;
    }

    if (newEmail === user.email) {
      toast.error("New email must be different from current email");
      return;
    }

    setIsEmailSaving(true);
    try {
      const result = await updateProfile({
        email: newEmail,
        currentPassword: emailPassword,
      });

      if (result.success) {
        toast.success(SETTINGS_MESSAGES.EMAIL_SAVED);
        await onProfileChange?.();
        setCurrentStep("main");
      } else {
        toast.error(result.error);
      }
    } catch {
      toast.error("Failed to change email");
    } finally {
      setIsEmailSaving(false);
    }
  }, [newEmail, emailPassword, user.email, onProfileChange]);

  // Username handlers
  const handleUsernameSubmit = useCallback(async () => {
    if (!newUsername || !usernamePassword) {
      toast.error("All fields are required");
      return;
    }

    if (!usernameValidation.isValidFormat) {
      toast.error(usernameValidation.error || "Invalid username format");
      return;
    }

    if (usernameValidation.isAvailable === false) {
      toast.error("Username is already taken");
      return;
    }

    if (newUsername === user.username) {
      toast.error("New username must be different from current username");
      return;
    }

    setIsUsernameSaving(true);
    try {
      const result = await updateProfile({
        username: newUsername || null,
        currentPassword: usernamePassword,
      });

      if (result.success) {
        toast.success(SETTINGS_MESSAGES.USERNAME_SAVED);
        await onProfileChange?.();
        setCurrentStep("main");
      } else {
        toast.error(result.error);
      }
    } catch {
      toast.error("Failed to change username");
    } finally {
      setIsUsernameSaving(false);
    }
  }, [
    newUsername,
    usernamePassword,
    usernameValidation,
    user.username,
    onProfileChange,
  ]);

  // Main handlers
  const handleProfileImageDrop = useCallback((acceptedFiles: File[]) => {
    const file = acceptedFiles[0];
    if (file) {
      setProfileImage(file);
      setRemoveProfile(false);
      setProfileImagePreview(URL.createObjectURL(file));
    }
  }, []);

  const handleHeroImageDrop = useCallback((acceptedFiles: File[]) => {
    const file = acceptedFiles[0];
    if (file) {
      setHeroImage(file);
      setRemoveHero(false);
      setHeroImagePreview(URL.createObjectURL(file));
    }
  }, []);

  const handleRemoveProfileImage = useCallback(() => {
    setProfileImage(null);
    setProfileImagePreview(null);
    setRemoveProfile(true);
  }, []);

  const handleRemoveHeroImage = useCallback(() => {
    setHeroImage(null);
    setHeroImagePreview(null);
    setRemoveHero(true);
  }, []);

  /** Handles public profile toggle with confirmation when enabling. */
  const handlePublicToggle = useCallback(
    (checked: boolean) => {
      if (checked && !isPublic) {
        // Show confirmation when turning public on
        setShowPublicConfirm(true);
      } else {
        // Allow immediate toggle when turning off
        setIsPublic(checked);
      }
    },
    [isPublic]
  );

  /** Confirms enabling public profile. */
  const handlePublicConfirm = useCallback(() => {
    setIsPublic(true);
    setShowPublicConfirm(false);
  }, []);

  const handleMainCancel = useCallback(() => {
    setName(originalValues.name);
    setIsPublic(originalValues.isPublic);
    setProfileImage(null);
    setHeroImage(null);
    setProfileImagePreview(null);
    setHeroImagePreview(null);
    setRemoveProfile(false);
    setRemoveHero(false);
    onOpenChange(false);
  }, [originalValues, onOpenChange]);

  const handleMainSave = useCallback(async () => {
    setIsMainSaving(true);
    try {
      let hasError = false;

      const nameChanged = name !== originalValues.name;
      const isPublicChanged = isPublic !== originalValues.isPublic;

      // Update profile fields if any changed
      if ((nameChanged || isPublicChanged) && !hasError) {
        const updateData: {
          name?: string;
          isPublic?: boolean;
        } = {};

        if (nameChanged) {
          updateData.name = name;
        }
        if (isPublicChanged) {
          updateData.isPublic = isPublic;
        }

        const result = await updateProfile(updateData);

        if (!result.success) {
          toast.error(result.error);
          hasError = true;
        }
      }

      if (profileImage && !hasError) {
        const formData = new FormData();
        formData.append("file", profileImage);
        const result = await uploadProfileImage(formData);

        if (!result.success) {
          toast.error(result.error);
          hasError = true;
        }
      } else if (removeProfile && !hasError) {
        const result = await removeProfileImage();
        if (!result.success) {
          toast.error(result.error);
          hasError = true;
        }
      }

      if (heroImage && !hasError) {
        const formData = new FormData();
        formData.append("file", heroImage);
        const result = await uploadHeroImage(formData);

        if (!result.success) {
          toast.error(result.error);
          hasError = true;
        }
      } else if (removeHero && !hasError) {
        const result = await removeHeroImage();
        if (!result.success) {
          toast.error(result.error);
          hasError = true;
        }
      }

      if (!hasError) {
        toast.success(SETTINGS_MESSAGES.SAVED);
        await onProfileChange?.().catch(() => {});
        onOpenChange(false);
      }
    } catch {
      toast.error("Failed to update settings");
    } finally {
      setIsMainSaving(false);
    }
  }, [
    name,
    isPublic,
    profileImage,
    heroImage,
    removeProfile,
    removeHero,
    originalValues,
    onProfileChange,
    onOpenChange,
  ]);

  const handleDataExport = useCallback(async () => {
    setIsExporting(true);
    try {
      const result = await exportAccountData();
      if (result.success && result.data) {
        const blob = new Blob([JSON.stringify(result.data, null, 2)], {
          type: "application/json",
        });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `canoncore-export-${new Date().toISOString().slice(0, 10)}.json`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        // Delay revocation — click() is async, immediate revoke can cancel download
        setTimeout(() => URL.revokeObjectURL(url), 60_000);
        toast.success("Data exported successfully");
      } else if (!result.success) {
        toast.error(result.error);
      }
    } catch {
      toast.error("Failed to export data");
    } finally {
      setIsExporting(false);
    }
  }, []);

  const handleDeleteAccount = useCallback(async () => {
    setIsDeleting(true);
    try {
      const result = await deleteAccount(deletePassword, deleteConfirmText);
      if (result.success) {
        toast.success("Account deleted");
        await signOut({ callbackUrl: "/" });
      } else {
        toast.error(result.error);
      }
    } catch {
      toast.error("Failed to delete account");
    } finally {
      setIsDeleting(false);
    }
  }, [deletePassword, deleteConfirmText]);

  // Computed image sources
  const profileImageSrc = profileImagePreview
    ? profileImagePreview
    : !removeProfile && user.hasImage
      ? "/api/user/avatar"
      : null;

  const heroImageSrc = heroImagePreview
    ? heroImagePreview
    : !removeHero && user.hasHeroImage
      ? "/api/user/hero"
      : null;

  /**
   * Gets the header content for the current step.
   * Headers are rendered outside the animated area.
   */
  const getStepHeader = () => {
    switch (currentStep) {
      case "main":
        return (
          <DialogHeader>
            <div className="flex items-center gap-3">
              <div
                className={cn(
                  "flex size-10 shrink-0 items-center justify-center rounded-xl",
                  "bg-primary/10 ring-primary/20 ring-1"
                )}
              >
                <FontAwesomeIcon
                  icon={faGear}
                  aria-hidden="true"
                  className="text-primary size-5"
                />
              </div>
              <div className="min-w-0">
                <DialogTitle className="text-lg">Settings</DialogTitle>
                <DialogDescription className="text-sm">
                  Manage your account and connections
                </DialogDescription>
              </div>
            </div>
          </DialogHeader>
        );
      case "password":
        return (
          <DialogHeader>
            <div className="flex items-center gap-3">
              <Button
                variant="ghost"
                size="icon"
                onClick={handleBack}
                disabled={isPasswordSaving}
                className="hover:bg-muted/50 size-10 transition-all active:scale-95"
                aria-label="Back"
              >
                <FontAwesomeIcon
                  icon={faChevronLeft}
                  aria-hidden="true"
                  className="size-5"
                />
              </Button>
              <div
                className={cn(
                  "flex size-10 shrink-0 items-center justify-center rounded-xl",
                  "bg-primary/10 ring-primary/20 ring-1"
                )}
              >
                <FontAwesomeIcon
                  icon={faLock}
                  aria-hidden="true"
                  className="text-primary size-5"
                />
              </div>
              <div className="min-w-0">
                <DialogTitle className="text-lg">Change Password</DialogTitle>
                <DialogDescription className="text-sm">
                  Enter your current password and choose a new one
                </DialogDescription>
              </div>
            </div>
          </DialogHeader>
        );
      case "email":
        return (
          <DialogHeader>
            <div className="flex items-center gap-3">
              <Button
                variant="ghost"
                size="icon"
                onClick={handleBack}
                disabled={isEmailSaving}
                className="hover:bg-muted/50 size-10 transition-all active:scale-95"
                aria-label="Back"
              >
                <FontAwesomeIcon
                  icon={faChevronLeft}
                  aria-hidden="true"
                  className="size-5"
                />
              </Button>
              <div
                className={cn(
                  "flex size-10 shrink-0 items-center justify-center rounded-xl",
                  "bg-primary/10 ring-primary/20 ring-1"
                )}
              >
                <FontAwesomeIcon
                  icon={faEnvelope}
                  aria-hidden="true"
                  className="text-primary size-5"
                />
              </div>
              <div className="min-w-0">
                <DialogTitle className="text-lg">Change Email</DialogTitle>
                <DialogDescription className="text-sm">
                  Enter your new email and verify with your password
                </DialogDescription>
              </div>
            </div>
          </DialogHeader>
        );
      case "username":
        return (
          <DialogHeader>
            <div className="flex items-center gap-3">
              <Button
                variant="ghost"
                size="icon"
                onClick={handleBack}
                disabled={isUsernameSaving}
                className="hover:bg-muted/50 size-10 transition-all active:scale-95"
                aria-label="Back"
              >
                <FontAwesomeIcon
                  icon={faChevronLeft}
                  aria-hidden="true"
                  className="size-5"
                />
              </Button>
              <div
                className={cn(
                  "flex size-10 shrink-0 items-center justify-center rounded-xl",
                  "bg-primary/10 ring-primary/20 ring-1"
                )}
              >
                <FontAwesomeIcon
                  icon={faAt}
                  aria-hidden="true"
                  className="text-primary size-5"
                />
              </div>
              <div className="min-w-0">
                <DialogTitle className="text-lg">Change Username</DialogTitle>
                <DialogDescription className="text-sm">
                  Enter your new username and verify with your password
                </DialogDescription>
              </div>
            </div>
          </DialogHeader>
        );
      case "delete-account":
        return (
          <DialogHeader>
            <div className="flex items-center gap-3">
              <Button
                variant="ghost"
                size="icon"
                onClick={handleBack}
                disabled={isDeleting}
                className="hover:bg-muted/50 size-10 transition-all active:scale-95"
                aria-label="Back"
              >
                <FontAwesomeIcon
                  icon={faChevronLeft}
                  aria-hidden="true"
                  className="size-5"
                />
              </Button>
              <div
                className={cn(
                  "flex size-10 shrink-0 items-center justify-center rounded-xl",
                  "bg-destructive/10 ring-destructive/20 ring-1"
                )}
              >
                <FontAwesomeIcon
                  icon={faTrash}
                  aria-hidden="true"
                  className="text-destructive size-5"
                />
              </div>
              <div className="min-w-0">
                <DialogTitle className="text-lg">Delete Account</DialogTitle>
                <DialogDescription className="text-sm">
                  This action is permanent and cannot be undone
                </DialogDescription>
              </div>
            </div>
          </DialogHeader>
        );
      default:
        return null;
    }
  };

  /**
   * Gets the footer content for the current step.
   * Footers are rendered outside the animated area.
   */
  const getStepFooter = () => {
    switch (currentStep) {
      case "main":
        return (
          <DialogFooter>
            <Button
              variant="outline"
              onClick={handleMainCancel}
              disabled={isMainSaving}
            >
              Cancel
            </Button>
            <Button
              onClick={handleMainSave}
              disabled={!isDirty || isMainSaving}
            >
              {isMainSaving ? (
                <>
                  <FontAwesomeIcon
                    icon={faSpinner}
                    spin
                    aria-hidden="true"
                    className="size-4"
                  />
                  Saving…
                </>
              ) : (
                "Save Changes"
              )}
            </Button>
          </DialogFooter>
        );
      case "password":
        return (
          <DialogFooter>
            <Button
              variant="outline"
              onClick={handleBack}
              disabled={isPasswordSaving}
            >
              Cancel
            </Button>
            <Button onClick={handlePasswordSubmit} disabled={isPasswordSaving}>
              {isPasswordSaving ? (
                <>
                  <FontAwesomeIcon
                    icon={faSpinner}
                    spin
                    aria-hidden="true"
                    className="size-4"
                  />
                  Changing…
                </>
              ) : (
                "Change Password"
              )}
            </Button>
          </DialogFooter>
        );
      case "email":
        return (
          <DialogFooter>
            <Button
              variant="outline"
              onClick={handleBack}
              disabled={isEmailSaving}
            >
              Cancel
            </Button>
            <Button onClick={handleEmailSubmit} disabled={isEmailSaving}>
              {isEmailSaving ? (
                <>
                  <FontAwesomeIcon
                    icon={faSpinner}
                    spin
                    aria-hidden="true"
                    className="size-4"
                  />
                  Changing…
                </>
              ) : (
                "Change Email"
              )}
            </Button>
          </DialogFooter>
        );
      case "username":
        return (
          <DialogFooter>
            <Button
              variant="outline"
              onClick={handleBack}
              disabled={isUsernameSaving}
            >
              Cancel
            </Button>
            <Button onClick={handleUsernameSubmit} disabled={isUsernameSaving}>
              {isUsernameSaving ? (
                <>
                  <FontAwesomeIcon
                    icon={faSpinner}
                    spin
                    aria-hidden="true"
                    className="size-4"
                  />
                  Changing…
                </>
              ) : (
                "Change Username"
              )}
            </Button>
          </DialogFooter>
        );
      case "delete-account":
        return (
          <DialogFooter>
            <Button
              variant="outline"
              onClick={handleBack}
              disabled={isDeleting}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={handleDeleteAccount}
              disabled={
                isDeleting || !deletePassword || deleteConfirmText !== "DELETE"
              }
            >
              {isDeleting ? (
                <>
                  <FontAwesomeIcon
                    icon={faSpinner}
                    spin
                    aria-hidden="true"
                    className="size-4"
                  />
                  Deleting…
                </>
              ) : (
                "Delete My Account"
              )}
            </Button>
          </DialogFooter>
        );
      default:
        return null;
    }
  };

  /**
   * Gets the body content for the current step.
   * Bodies are rendered inside the animated area.
   */
  const getStepBody = () => {
    switch (currentStep) {
      case "main":
        return (
          <Tabs defaultValue={defaultTab} className="w-full">
            <TabsList className="mb-4 grid w-full grid-cols-4">
              <TabsTrigger value="profile" data-testid="settings-tab-profile">
                Profile
              </TabsTrigger>
              <TabsTrigger value="account" data-testid="settings-tab-account">
                Account
              </TabsTrigger>
              <TabsTrigger
                value="connections"
                data-testid="settings-tab-connections"
              >
                Connections
              </TabsTrigger>
              <TabsTrigger value="activity" data-testid="settings-tab-activity">
                Activity
              </TabsTrigger>
            </TabsList>

            <TabsContent value="profile" className="mt-0">
              <div className="min-w-0 space-y-6">
                {/* Visual Profile Card with Cover + Avatar */}
                <Card className="overflow-hidden pt-0">
                  {/* Cover/Hero Image */}
                  <FileUpload
                    value={heroImage ? [heroImage] : []}
                    onValueChange={(files) => {
                      if (files.length > 0) {
                        handleHeroImageDrop(files);
                      }
                    }}
                    accept="image/*"
                    maxFiles={1}
                    maxSize={5 * 1024 * 1024}
                  >
                    <div
                      className="bg-muted relative h-32 bg-cover bg-center sm:h-40"
                      style={{
                        backgroundImage: heroImageSrc
                          ? `url(${heroImageSrc})`
                          : undefined,
                      }}
                    >
                      <div className="absolute inset-0 bg-black/20" />
                      <div className="absolute right-3 bottom-3 flex gap-2">
                        <FileUploadTrigger asChild>
                          <Button
                            size="sm"
                            variant="secondary"
                            className="shadow-md"
                          >
                            <FontAwesomeIcon
                              icon={faUpload}
                              className="mr-2 size-4"
                            />
                            Change Cover
                          </Button>
                        </FileUploadTrigger>
                        {heroImage && (
                          <Button
                            size="icon"
                            variant="secondary"
                            className="size-8 shadow-md"
                            aria-label="Remove cover"
                            onClick={() => {
                              setHeroImage(null);
                              setHeroImagePreview(null);
                            }}
                          >
                            <FontAwesomeIcon
                              icon={faXmark}
                              className="size-4"
                            />
                          </Button>
                        )}
                      </div>
                    </div>
                  </FileUpload>

                  <CardContent className="-mt-12 pb-0 sm:-mt-14">
                    <div className="flex flex-col items-center gap-4 sm:flex-row sm:items-end">
                      {/* Avatar with Upload */}
                      <FileUpload
                        value={profileImage ? [profileImage] : []}
                        onValueChange={(files) => {
                          if (files.length > 0) {
                            handleProfileImageDrop(files);
                          }
                        }}
                        accept="image/*"
                        maxFiles={1}
                        maxSize={2 * 1024 * 1024}
                      >
                        <div className="relative">
                          <Avatar className="border-card size-24 border-4 shadow-lg sm:size-28">
                            <AvatarImage
                              src={profileImageSrc || undefined}
                              alt={name || "Profile"}
                              className="object-cover"
                            />
                            <AvatarFallback className="text-2xl font-semibold">
                              {name
                                ?.split(" ")
                                .map((n) => n[0])
                                .join("")
                                .toUpperCase()
                                .slice(0, 2) || (
                                <FontAwesomeIcon
                                  icon={faUser}
                                  aria-hidden="true"
                                  className="text-muted-foreground size-10"
                                />
                              )}
                            </AvatarFallback>
                          </Avatar>
                          <FileUploadTrigger asChild>
                            <Button
                              size="icon"
                              variant="secondary"
                              className="absolute -right-1 -bottom-1 size-8 rounded-full shadow-md"
                              aria-label="Upload avatar"
                            >
                              <FontAwesomeIcon
                                icon={faUpload}
                                className="size-4"
                              />
                            </Button>
                          </FileUploadTrigger>
                        </div>
                      </FileUpload>
                      <div className="space-y-1 text-center sm:pb-1 sm:text-left">
                        <h3 className="text-lg font-semibold">
                          {name || "Your Name"}
                        </h3>
                        <p className="text-muted-foreground text-sm">
                          {user.email}
                        </p>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                {/* Basic Info Card */}
                <Card>
                  <CardHeader>
                    <CardTitle>Basic Information</CardTitle>
                    <CardDescription>
                      This information will be displayed on your public profile
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="space-y-2">
                      <Label htmlFor="settings-name">Display Name</Label>
                      <Input
                        id="settings-name"
                        name="name"
                        autoComplete="name"
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        placeholder="Your name"
                      />
                    </div>
                  </CardContent>
                </Card>

                {/* Remove buttons for existing images */}
                {((user.hasImage && !removeProfile) ||
                  (user.hasHeroImage && !removeHero)) && (
                  <Card>
                    <CardHeader>
                      <CardTitle>Remove Images</CardTitle>
                      <CardDescription>
                        Remove your existing profile images
                      </CardDescription>
                    </CardHeader>
                    <CardContent className="flex gap-2">
                      {user.hasImage && !removeProfile && (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={handleRemoveProfileImage}
                        >
                          Remove Avatar
                        </Button>
                      )}
                      {user.hasHeroImage && !removeHero && (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={handleRemoveHeroImage}
                        >
                          Remove Cover
                        </Button>
                      )}
                    </CardContent>
                  </Card>
                )}

                {/* Public Profile Toggle */}
                <div className="space-y-3">
                  <div className="flex items-center justify-between rounded-lg border p-4">
                    <div className="flex items-center gap-3">
                      <div
                        className={cn(
                          "flex size-9 items-center justify-center rounded-lg",
                          isPublic ? "bg-green-500/10" : "bg-muted"
                        )}
                      >
                        <FontAwesomeIcon
                          icon={faGlobe}
                          aria-hidden="true"
                          className={cn(
                            "size-4",
                            isPublic
                              ? "text-green-500"
                              : "text-muted-foreground"
                          )}
                        />
                      </div>
                      <div className="space-y-0.5">
                        <Label
                          htmlFor="settings-public"
                          className="text-sm font-medium"
                        >
                          Public Profile
                        </Label>
                        <p className="text-muted-foreground text-xs">
                          {isPublic
                            ? "Your profile is visible to anyone"
                            : "Your profile is private"}
                        </p>
                      </div>
                    </div>
                    <Switch
                      id="settings-public"
                      checked={isPublic}
                      onCheckedChange={handlePublicToggle}
                    />
                  </div>
                  <p className="text-muted-foreground text-xs">
                    When enabled, others can view your public items at your
                    profile URL.
                    {!user.username &&
                      " Set a username in the Account tab to enable your public profile."}
                  </p>
                </div>
              </div>
            </TabsContent>

            <TabsContent value="account" className="mt-0">
              <div className="min-w-0 space-y-6">
                <Card>
                  <CardHeader>
                    <CardTitle>Username</CardTitle>
                    <CardDescription>
                      Your unique identifier for your public profile URL
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="flex items-center justify-between gap-4">
                      <span className="text-muted-foreground truncate text-sm">
                        {user.username
                          ? `@${user.username}`
                          : "No username set"}
                      </span>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => setCurrentStep("username")}
                      >
                        Change Username
                      </Button>
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle>Email Address</CardTitle>
                    <CardDescription>
                      Your email for account access and notifications
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="flex items-center justify-between gap-4">
                      <span className="text-muted-foreground truncate text-sm">
                        {user.email}
                      </span>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => setCurrentStep("email")}
                      >
                        Change Email
                      </Button>
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle>Password</CardTitle>
                    <CardDescription>
                      Keep your account secure with a strong password
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => setCurrentStep("password")}
                      className="w-full"
                    >
                      <FontAwesomeIcon
                        icon={faLock}
                        aria-hidden="true"
                        className="mr-2 size-4"
                      />
                      Change Password
                    </Button>
                  </CardContent>
                </Card>

                {/* Your Data */}
                <Card>
                  <CardHeader>
                    <CardTitle>Your Data</CardTitle>
                    <CardDescription>
                      Download a copy of all your data as JSON
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <Button
                      type="button"
                      variant="outline"
                      onClick={handleDataExport}
                      disabled={isExporting}
                      className="w-full"
                    >
                      {isExporting ? (
                        <>
                          <FontAwesomeIcon
                            icon={faSpinner}
                            spin
                            aria-hidden="true"
                            className="mr-2 size-4"
                          />
                          Preparing…
                        </>
                      ) : (
                        <>
                          <FontAwesomeIcon
                            icon={faDownload}
                            aria-hidden="true"
                            className="mr-2 size-4"
                          />
                          Download My Data
                        </>
                      )}
                    </Button>
                  </CardContent>
                </Card>

                {/* Danger Zone */}
                <Card className="border-destructive/30">
                  <CardHeader>
                    <CardTitle className="text-destructive">
                      Danger Zone
                    </CardTitle>
                    <CardDescription>
                      Permanently delete your account and all associated data
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <Button
                      type="button"
                      variant="destructive"
                      onClick={() => setCurrentStep("delete-account")}
                      className="w-full"
                    >
                      Delete Account
                    </Button>
                  </CardContent>
                </Card>
              </div>
            </TabsContent>

            <TabsContent value="connections" className="mt-0">
              <div className="min-w-0 space-y-6">
                <Card>
                  <CardHeader>
                    <CardTitle>Google Drive</CardTitle>
                    <CardDescription>
                      Sync your media files with Google Drive
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <GoogleDriveSettingsSection
                      connection={googleDriveConnection}
                      onConnectionChange={onProfileChange}
                    />
                  </CardContent>
                </Card>
              </div>
            </TabsContent>

            <TabsContent value="activity" className="mt-0">
              {googleDriveConnection ? (
                <div className="max-h-80 overflow-y-auto">
                  <SyncHistory />
                </div>
              ) : (
                <div className="space-y-4 py-8 text-center">
                  <div className="bg-muted/50 mx-auto flex size-12 items-center justify-center rounded-full">
                    <FontAwesomeIcon
                      icon={faCloud}
                      aria-hidden="true"
                      className="text-muted-foreground size-6"
                    />
                  </div>
                  <div className="space-y-1">
                    <p className="text-sm font-medium">No sync activity</p>
                    <p className="text-muted-foreground text-sm">
                      Connect Google Drive to track sync history
                    </p>
                  </div>
                </div>
              )}
            </TabsContent>
          </Tabs>
        );
      case "password":
        return (
          <div
            className="space-y-4 py-4"
            onKeyDown={(e) => {
              if (e.key === "Enter" && !isPasswordSaving) {
                e.preventDefault();
                handlePasswordSubmit();
              }
            }}
          >
            <div className="space-y-2">
              <Label htmlFor="change-current-password">Current Password</Label>
              <PasswordInput
                id="change-current-password"
                name="current-password"
                autoComplete="current-password"
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                placeholder="Enter current password"
                className="h-10"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="change-new-password">New Password</Label>
              <PasswordInput
                id="change-new-password"
                name="new-password"
                autoComplete="new-password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="Enter new password"
                className="h-10"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="change-confirm-password">
                Confirm New Password
              </Label>
              <PasswordInput
                id="change-confirm-password"
                name="confirm-password"
                autoComplete="new-password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="Repeat new password"
                className="h-10"
              />
            </div>

            <p className="text-muted-foreground text-xs">
              8+ characters with uppercase, lowercase, and number.
            </p>
          </div>
        );
      case "email":
        return (
          <div
            className="space-y-4 py-4"
            onKeyDown={(e) => {
              if (e.key === "Enter" && !isEmailSaving) {
                e.preventDefault();
                handleEmailSubmit();
              }
            }}
          >
            <div className="space-y-2">
              <Label htmlFor="change-new-email">New Email</Label>
              <Input
                id="change-new-email"
                name="email"
                type="email"
                autoComplete="email"
                spellCheck={false}
                value={newEmail}
                onChange={(e) => setNewEmail(e.target.value)}
                placeholder="Enter new email address"
                className="h-10"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="change-email-password">Current Password</Label>
              <PasswordInput
                id="change-email-password"
                name="current-password"
                autoComplete="current-password"
                value={emailPassword}
                onChange={(e) => setEmailPassword(e.target.value)}
                placeholder="Verify with your password"
                className="h-10"
              />
              <p className="text-muted-foreground text-xs">
                Password required to confirm this change.
              </p>
            </div>
          </div>
        );
      case "delete-account":
        return (
          <div className="space-y-4 py-4">
            <div className="bg-destructive/10 border-destructive/20 rounded-lg border p-3">
              <p className="text-destructive text-sm font-medium">
                This will permanently delete your account, all items, playlists,
                and uploaded files. If Google Drive is connected, your CanonCore
                folder will be moved to trash.
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="delete-password">Password</Label>
              <PasswordInput
                id="delete-password"
                name="current-password"
                autoComplete="current-password"
                value={deletePassword}
                onChange={(e) => setDeletePassword(e.target.value)}
                placeholder="Enter your password"
                className="h-10"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="delete-confirm">
                Type <span className="font-mono font-bold">DELETE</span> to
                confirm
              </Label>
              <Input
                id="delete-confirm"
                autoComplete="off"
                value={deleteConfirmText}
                onChange={(e) => setDeleteConfirmText(e.target.value)}
                placeholder="DELETE"
                className="h-10"
              />
            </div>
          </div>
        );
      case "username":
        return (
          <div
            className="space-y-4 py-4"
            onKeyDown={(e) => {
              if (e.key === "Enter" && !isUsernameSaving) {
                e.preventDefault();
                handleUsernameSubmit();
              }
            }}
          >
            <div className="space-y-2">
              <Label htmlFor="change-new-username">New Username</Label>
              <div className="relative">
                <Input
                  id="change-new-username"
                  name="username"
                  autoComplete="username"
                  spellCheck={false}
                  value={newUsername}
                  onChange={(e) =>
                    setNewUsername(
                      e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, "")
                    )
                  }
                  placeholder="Enter new username"
                  className={cn(
                    "h-10 pr-10",
                    newUsername &&
                      usernameValidation.isValidFormat &&
                      usernameValidation.isAvailable === true &&
                      "border-green-500 focus-visible:ring-green-500/20",
                    newUsername &&
                      (usernameValidation.error ||
                        usernameValidation.isAvailable === false) &&
                      "border-destructive focus-visible:ring-destructive/20"
                  )}
                />
                {newUsername && (
                  <div className="absolute top-1/2 right-3 -translate-y-1/2">
                    {usernameValidation.isValidating ? (
                      <FontAwesomeIcon
                        icon={faSpinner}
                        spin
                        aria-hidden="true"
                        className="text-muted-foreground size-4"
                      />
                    ) : usernameValidation.isValidFormat &&
                      usernameValidation.isAvailable === true ? (
                      <FontAwesomeIcon
                        icon={faCheck}
                        aria-hidden="true"
                        className="size-4 text-green-500"
                      />
                    ) : usernameValidation.error ||
                      usernameValidation.isAvailable === false ? (
                      <FontAwesomeIcon
                        icon={faXmark}
                        aria-hidden="true"
                        className="text-destructive size-4"
                      />
                    ) : null}
                  </div>
                )}
              </div>
              {newUsername && usernameValidation.error && (
                <p role="alert" className="text-destructive text-xs">
                  {usernameValidation.error}
                </p>
              )}
              {newUsername &&
                usernameValidation.isAvailable === false &&
                !usernameValidation.error && (
                  <p role="alert" className="text-destructive text-xs">
                    Username is already taken
                  </p>
                )}
              {newUsername &&
                usernameValidation.isValidFormat &&
                usernameValidation.isAvailable === true && (
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
              <Label htmlFor="change-username-password">Current Password</Label>
              <PasswordInput
                id="change-username-password"
                name="current-password"
                autoComplete="current-password"
                value={usernamePassword}
                onChange={(e) => setUsernamePassword(e.target.value)}
                placeholder="Verify with your password"
                className="h-10"
              />
              <p className="text-muted-foreground text-xs">
                Password required to confirm this change.
              </p>
            </div>
          </div>
        );
      default:
        return null;
    }
  };

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <AnimatedDialogContent
          stepKey={currentStep}
          className="max-h-[90vh] sm:max-w-2xl"
          data-testid="dialog-settings"
          header={getStepHeader()}
          footer={getStepFooter()}
        >
          {getStepBody()}
        </AnimatedDialogContent>
      </Dialog>

      {/* Public profile confirmation dialog */}
      <AlertDialog open={showPublicConfirm} onOpenChange={setShowPublicConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <FontAwesomeIcon
                icon={faGlobe}
                aria-hidden="true"
                className="text-brand h-5 w-5"
              />
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
            <AlertDialogAction onClick={handlePublicConfirm}>
              Make Public
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
