/**
 * Settings dialog with profile and Google Drive settings.
 * Handles name, email, password changes, image uploads, and Drive connection.
 * Uses step-based navigation for password/email changes instead of stacked modals.
 */

"use client";

import { useState, useCallback, useEffect, useMemo } from "react";
import {
  Loader2,
  Settings,
  Mail,
  Lock,
  ImageIcon,
  Sparkles,
  Trash2,
  ChevronLeft,
} from "lucide-react";
import { Dialog } from "@/components/ui/dialog";
import { AnimatedDialogContent } from "@/components/ui/animated-dialog-content";
import {
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Dropzone } from "@/components/ui/dropzone";
import { PasswordInput } from "@/components/ui/password-input";
import {
  updateProfile,
  uploadProfileImage,
  uploadHeroImage,
  removeProfileImage,
  removeHeroImage,
  changePassword,
} from "@/lib/user-actions";
import { passwordSchema, emailSchema } from "@/lib/validations";
import { GoogleDriveSettingsSection } from "@/components/google-drive";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { PreferencesTab } from "@/components/profile/preferences-tab";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import type { GoogleDriveConnection } from "@/lib/types";

/** Steps for settings dialog navigation. */
type SettingsStep = "main" | "password" | "email";

interface SettingsDialogProps {
  /** Whether the dialog is open */
  open: boolean;
  /** Callback when dialog open state changes */
  onOpenChange: (open: boolean) => void;
  /** Current user profile data */
  user: {
    name: string | null;
    email: string;
    hasImage: boolean;
    hasHeroImage: boolean;
  };
  /** Google Drive connection (null if not connected) */
  googleDriveConnection: GoogleDriveConnection | null;
  /** Callback when profile is updated */
  onProfileChange?: () => Promise<void>;
}

// ============================================================================
// Password Change Step Content
// ============================================================================

interface PasswordChangeContentProps {
  onBack: () => void;
  onSuccess: () => void;
}

/**
 * Inline content for password change step.
 */
function PasswordChangeContent({
  onBack,
  onSuccess,
}: PasswordChangeContentProps) {
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [isSaving, setIsSaving] = useState(false);

  const handleSubmit = useCallback(async () => {
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

    setIsSaving(true);
    try {
      const result = await changePassword({ currentPassword, newPassword });

      if (result.success) {
        toast.success("Password changed successfully");
        onSuccess();
      } else {
        toast.error(result.error);
      }
    } catch {
      toast.error("Failed to change password");
    } finally {
      setIsSaving(false);
    }
  }, [currentPassword, newPassword, confirmPassword, onSuccess]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "Enter" && !isSaving) {
        e.preventDefault();
        handleSubmit();
      }
    },
    [handleSubmit, isSaving]
  );

  return (
    <>
      <DialogHeader>
        <div className="flex items-center gap-3">
          <Button
            variant="ghost"
            size="icon"
            onClick={onBack}
            disabled={isSaving}
            className="hover:bg-muted/50 size-10 transition-all active:scale-95"
            aria-label="Back"
          >
            <ChevronLeft className="size-5" />
          </Button>
          <div
            className={cn(
              "flex size-10 shrink-0 items-center justify-center rounded-xl",
              "bg-primary/10 ring-primary/20 ring-1"
            )}
          >
            <Lock className="text-primary size-5" />
          </div>
          <div className="min-w-0">
            <DialogTitle className="text-lg">Change Password</DialogTitle>
            <DialogDescription className="text-sm">
              Enter your current password and choose a new one
            </DialogDescription>
          </div>
        </div>
      </DialogHeader>

      <div className="space-y-4 py-4" onKeyDown={handleKeyDown}>
        <div className="space-y-2">
          <Label htmlFor="change-current-password">Current Password</Label>
          <PasswordInput
            id="change-current-password"
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
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            placeholder="Enter new password"
            className="h-10"
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="change-confirm-password">Confirm New Password</Label>
          <PasswordInput
            id="change-confirm-password"
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

      <DialogFooter>
        <Button variant="outline" onClick={onBack} disabled={isSaving}>
          Cancel
        </Button>
        <Button onClick={handleSubmit} disabled={isSaving}>
          {isSaving ? (
            <>
              <Loader2 className="size-4 animate-spin" />
              Changing...
            </>
          ) : (
            "Change Password"
          )}
        </Button>
      </DialogFooter>
    </>
  );
}

// ============================================================================
// Email Change Step Content
// ============================================================================

interface EmailChangeContentProps {
  currentEmail: string;
  onBack: () => void;
  onSuccess: () => void;
}

/**
 * Inline content for email change step.
 */
function EmailChangeContent({
  currentEmail,
  onBack,
  onSuccess,
}: EmailChangeContentProps) {
  const [newEmail, setNewEmail] = useState(currentEmail);
  const [password, setPassword] = useState("");
  const [isSaving, setIsSaving] = useState(false);

  // Reset form when currentEmail changes
  useEffect(() => {
    setNewEmail(currentEmail);
    setPassword("");
  }, [currentEmail]);

  const handleSubmit = useCallback(async () => {
    if (!newEmail || !password) {
      toast.error("All fields are required");
      return;
    }

    const validation = emailSchema.safeParse(newEmail);
    if (!validation.success) {
      toast.error("Invalid email format");
      return;
    }

    if (newEmail === currentEmail) {
      toast.error("New email must be different from current email");
      return;
    }

    setIsSaving(true);
    try {
      const result = await updateProfile({
        email: newEmail,
        currentPassword: password,
      });

      if (result.success) {
        toast.success("Email changed successfully");
        onSuccess();
      } else {
        toast.error(result.error);
      }
    } catch {
      toast.error("Failed to change email");
    } finally {
      setIsSaving(false);
    }
  }, [newEmail, password, currentEmail, onSuccess]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "Enter" && !isSaving) {
        e.preventDefault();
        handleSubmit();
      }
    },
    [handleSubmit, isSaving]
  );

  return (
    <>
      <DialogHeader>
        <div className="flex items-center gap-3">
          <Button
            variant="ghost"
            size="icon"
            onClick={onBack}
            disabled={isSaving}
            className="hover:bg-muted/50 size-10 transition-all active:scale-95"
            aria-label="Back"
          >
            <ChevronLeft className="size-5" />
          </Button>
          <div
            className={cn(
              "flex size-10 shrink-0 items-center justify-center rounded-xl",
              "bg-primary/10 ring-primary/20 ring-1"
            )}
          >
            <Mail className="text-primary size-5" />
          </div>
          <div className="min-w-0">
            <DialogTitle className="text-lg">Change Email</DialogTitle>
            <DialogDescription className="text-sm">
              Enter your new email and verify with your password
            </DialogDescription>
          </div>
        </div>
      </DialogHeader>

      <div className="space-y-4 py-4" onKeyDown={handleKeyDown}>
        <div className="space-y-2">
          <Label htmlFor="change-new-email">New Email</Label>
          <Input
            id="change-new-email"
            type="email"
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
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Verify with your password"
            className="h-10"
          />
          <p className="text-muted-foreground text-xs">
            Password required to confirm this change.
          </p>
        </div>
      </div>

      <DialogFooter>
        <Button variant="outline" onClick={onBack} disabled={isSaving}>
          Cancel
        </Button>
        <Button onClick={handleSubmit} disabled={isSaving}>
          {isSaving ? (
            <>
              <Loader2 className="size-4 animate-spin" />
              Changing...
            </>
          ) : (
            "Change Email"
          )}
        </Button>
      </DialogFooter>
    </>
  );
}

// ============================================================================
// Main Settings Content
// ============================================================================

interface MainSettingsContentProps {
  user: SettingsDialogProps["user"];
  googleDriveConnection: GoogleDriveConnection | null;
  onProfileChange?: () => Promise<void>;
  onOpenChange: (open: boolean) => void;
  onPasswordClick: () => void;
  onEmailClick: () => void;
}

/**
 * Main settings view with profile options.
 */
function MainSettingsContent({
  user,
  googleDriveConnection,
  onProfileChange,
  onOpenChange,
  onPasswordClick,
  onEmailClick,
}: MainSettingsContentProps) {
  // Form state
  const [name, setName] = useState(user.name ?? "");
  const [email] = useState(user.email);

  // Image state
  const [profileImage, setProfileImage] = useState<File | null>(null);
  const [heroImage, setHeroImage] = useState<File | null>(null);
  const [profileImagePreview, setProfileImagePreview] = useState<string | null>(
    null
  );
  const [heroImagePreview, setHeroImagePreview] = useState<string | null>(null);
  const [removeProfile, setRemoveProfile] = useState(false);
  const [removeHero, setRemoveHero] = useState(false);

  const [isSaving, setIsSaving] = useState(false);

  // Original values for dirty checking
  const originalValues = useMemo(
    () => ({
      name: user.name ?? "",
      email: user.email,
    }),
    [user.name, user.email]
  );

  // Reset form when user changes
  useEffect(() => {
    setName(user.name ?? "");
    setProfileImage(null);
    setHeroImage(null);
    setProfileImagePreview(null);
    setHeroImagePreview(null);
    setRemoveProfile(false);
    setRemoveHero(false);
  }, [user.name, user.email]);

  // Dirty state detection
  const isDirty = useMemo(() => {
    const nameChanged = name !== originalValues.name;
    const profileImageChanging = profileImage !== null || removeProfile;
    const heroImageChanging = heroImage !== null || removeHero;

    return nameChanged || profileImageChanging || heroImageChanging;
  }, [
    name,
    profileImage,
    heroImage,
    removeProfile,
    removeHero,
    originalValues,
  ]);

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

  const handleCancel = useCallback(() => {
    setName(originalValues.name);
    setProfileImage(null);
    setHeroImage(null);
    setProfileImagePreview(null);
    setHeroImagePreview(null);
    setRemoveProfile(false);
    setRemoveHero(false);
    onOpenChange(false);
  }, [originalValues, onOpenChange]);

  const handleSave = useCallback(async () => {
    setIsSaving(true);
    try {
      let hasError = false;

      const nameChanged = name !== originalValues.name;

      if (nameChanged) {
        const result = await updateProfile({ name });

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
        toast.success("Settings updated");
        await onProfileChange?.().catch(() => {});
        onOpenChange(false);
      }
    } catch {
      toast.error("Failed to update settings");
    } finally {
      setIsSaving(false);
    }
  }, [
    name,
    profileImage,
    heroImage,
    removeProfile,
    removeHero,
    originalValues,
    onProfileChange,
    onOpenChange,
  ]);

  // Cleanup preview URLs on unmount
  useEffect(() => {
    return () => {
      if (profileImagePreview) URL.revokeObjectURL(profileImagePreview);
      if (heroImagePreview) URL.revokeObjectURL(heroImagePreview);
    };
  }, [profileImagePreview, heroImagePreview]);

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

  return (
    <>
      <DialogHeader>
        <div className="flex items-center gap-3">
          <div
            className={cn(
              "flex size-10 shrink-0 items-center justify-center rounded-xl",
              "bg-primary/10 ring-primary/20 ring-1"
            )}
          >
            <Settings className="text-primary size-5" />
          </div>
          <div className="min-w-0">
            <DialogTitle className="text-lg">Settings</DialogTitle>
            <DialogDescription className="text-sm">
              Manage your account and connections
            </DialogDescription>
          </div>
        </div>
      </DialogHeader>

      <Tabs defaultValue="profile" className="w-full">
        <TabsList className="mb-4 grid w-full grid-cols-2">
          <TabsTrigger value="profile">Profile</TabsTrigger>
          <TabsTrigger value="preferences">Preferences</TabsTrigger>
        </TabsList>

        <TabsContent value="profile" className="mt-0">
          <div className="min-w-0 space-y-6">
            {/* Google Drive Section */}
            <GoogleDriveSettingsSection
              connection={googleDriveConnection}
              onConnectionChange={onProfileChange}
            />

            <Separator />

            {/* Profile Picture Section */}
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <div
                  className={cn(
                    "flex size-7 items-center justify-center rounded-lg",
                    "bg-primary/10"
                  )}
                >
                  <ImageIcon className="text-primary size-3.5" />
                </div>
                <Label className="text-sm font-medium">Profile Picture</Label>
              </div>

              <Dropzone
                accept={{
                  "image/jpeg": [],
                  "image/png": [],
                  "image/webp": [],
                }}
                maxSize={1024 * 1024}
                maxFiles={1}
                onDrop={handleProfileImageDrop}
                onError={(error) => toast.error(error.message)}
                src={profileImage ? [profileImage] : undefined}
                className="h-24 w-full rounded-lg p-0"
                data-testid="profile-dropzone"
              >
                {profileImageSrc ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={profileImageSrc}
                    alt="Profile preview"
                    className="size-full rounded-lg object-cover"
                  />
                ) : (
                  <div className="flex size-full flex-col items-center justify-center gap-1">
                    <ImageIcon className="text-muted-foreground/50 size-6" />
                    <p className="text-muted-foreground text-xs">
                      Drag and drop or click to upload
                    </p>
                  </div>
                )}
              </Dropzone>

              {(user.hasImage || profileImage) && !removeProfile && (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={handleRemoveProfileImage}
                >
                  <Trash2 className="mr-1.5 size-3.5" />
                  Remove
                </Button>
              )}
              <p className="text-muted-foreground text-xs">
                Drag and drop or click to upload. JPEG, PNG, or WebP. Max 1MB.
              </p>
            </div>

            {/* Name Section */}
            <div className="space-y-3">
              <Label htmlFor="settings-name" className="text-sm font-medium">
                Display Name
              </Label>
              <Input
                id="settings-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Your name"
                className="h-10"
              />
            </div>

            {/* Email Section */}
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <div
                  className={cn(
                    "flex size-7 items-center justify-center rounded-lg",
                    "bg-primary/10"
                  )}
                >
                  <Mail className="text-primary size-3.5" />
                </div>
                <Label className="text-sm font-medium">Email</Label>
              </div>
              <div className="flex items-center justify-between gap-4">
                <span className="text-muted-foreground truncate text-sm">
                  {email}
                </span>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={onEmailClick}
                >
                  Change Email
                </Button>
              </div>
            </div>

            <Separator />

            {/* Hero Banner Section */}
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <div
                  className={cn(
                    "flex size-7 items-center justify-center rounded-lg",
                    "bg-primary/10"
                  )}
                >
                  <Sparkles className="text-primary size-3.5" />
                </div>
                <Label className="text-sm font-medium">Hero Banner</Label>
              </div>
              <p className="text-muted-foreground text-xs">
                Displayed at the top of your My Items page.
              </p>

              <Dropzone
                accept={{
                  "image/jpeg": [],
                  "image/png": [],
                  "image/webp": [],
                }}
                maxSize={2 * 1024 * 1024}
                maxFiles={1}
                onDrop={handleHeroImageDrop}
                onError={(error) => toast.error(error.message)}
                src={heroImage ? [heroImage] : undefined}
                className="h-24 w-full rounded-lg p-0"
                data-testid="hero-dropzone"
              >
                {heroImageSrc ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={heroImageSrc}
                    alt="Hero preview"
                    className="size-full rounded-lg object-cover"
                  />
                ) : (
                  <div className="flex size-full flex-col items-center justify-center gap-1">
                    <Sparkles className="text-muted-foreground/50 size-6" />
                    <p className="text-muted-foreground text-xs">
                      Drag and drop or click to upload
                    </p>
                  </div>
                )}
              </Dropzone>

              {(user.hasHeroImage || heroImage) && !removeHero && (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={handleRemoveHeroImage}
                >
                  <Trash2 className="mr-1.5 size-3.5" />
                  Remove Banner
                </Button>
              )}
              <p className="text-muted-foreground text-xs">
                Wide format recommended. Max 2MB.
              </p>
            </div>

            <Separator />

            {/* Password Section */}
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <div
                  className={cn(
                    "flex size-7 items-center justify-center rounded-lg",
                    "bg-primary/10"
                  )}
                >
                  <Lock className="text-primary size-3.5" />
                </div>
                <Label className="text-sm font-medium">Password</Label>
              </div>
              <Button
                type="button"
                variant="outline"
                onClick={onPasswordClick}
                className="w-full"
              >
                <Lock className="mr-2 size-4" />
                Change Password
              </Button>
              <p className="text-muted-foreground text-xs">
                Update your password to keep your account secure.
              </p>
            </div>
          </div>
        </TabsContent>

        <TabsContent value="preferences" className="mt-0">
          <PreferencesTab />
        </TabsContent>
      </Tabs>

      <DialogFooter>
        <Button variant="outline" onClick={handleCancel} disabled={isSaving}>
          Cancel
        </Button>
        <Button onClick={handleSave} disabled={!isDirty || isSaving}>
          {isSaving ? (
            <>
              <Loader2 className="size-4 animate-spin" />
              Saving...
            </>
          ) : (
            "Save Changes"
          )}
        </Button>
      </DialogFooter>
    </>
  );
}

// ============================================================================
// Settings Dialog Component
// ============================================================================

/**
 * Settings dialog with profile and Google Drive sections.
 * Uses step-based navigation for password/email changes.
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
}: SettingsDialogProps) {
  const [currentStep, setCurrentStep] = useState<SettingsStep>("main");

  // Reset step when dialog opens to ensure fresh state
  useEffect(() => {
    if (open) {
      setCurrentStep("main"); // eslint-disable-line react-hooks/set-state-in-effect -- legitimate prop sync on dialog open
    }
  }, [open]);

  const handlePasswordSuccess = useCallback(() => {
    setCurrentStep("main");
  }, []);

  const handleEmailSuccess = useCallback(async () => {
    await onProfileChange?.();
    setCurrentStep("main");
  }, [onProfileChange]);

  const handleBack = useCallback(() => {
    setCurrentStep("main");
  }, []);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <AnimatedDialogContent
        stepKey={currentStep}
        className="max-h-[90vh] overflow-y-auto"
      >
        {currentStep === "main" && (
          <MainSettingsContent
            user={user}
            googleDriveConnection={googleDriveConnection}
            onProfileChange={onProfileChange}
            onOpenChange={onOpenChange}
            onPasswordClick={() => setCurrentStep("password")}
            onEmailClick={() => setCurrentStep("email")}
          />
        )}
        {currentStep === "password" && (
          <PasswordChangeContent
            onBack={handleBack}
            onSuccess={handlePasswordSuccess}
          />
        )}
        {currentStep === "email" && (
          <EmailChangeContent
            currentEmail={user.email}
            onBack={handleBack}
            onSuccess={handleEmailSuccess}
          />
        )}
      </AnimatedDialogContent>
    </Dialog>
  );
}
