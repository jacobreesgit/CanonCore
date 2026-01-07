/**
 * Profile settings dialog with atomic save.
 * Handles name, email, password changes, and image uploads.
 * Features dirty state tracking and image previews.
 */

"use client";

import { useState, useCallback, useEffect, useMemo, useRef } from "react";
import {
  Loader2,
  User,
  Mail,
  Lock,
  ImageIcon,
  Sparkles,
  Upload,
  Trash2,
  Eye,
  EyeOff,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  updateProfile,
  changePassword,
  uploadProfileImage,
  uploadHeroImage,
  removeProfileImage,
  removeHeroImage,
} from "@/lib/user-actions";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

interface ProfileSettingsDialogProps {
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
  /** Callback when profile is updated */
  onProfileChange?: () => Promise<void>;
}

/**
 * Profile settings dialog with single atomic save pattern.
 * Supports profile picture and hero banner uploads with previews.
 *
 * @param open - Whether dialog is visible
 * @param onOpenChange - Callback for visibility changes
 * @param user - Current user profile data
 * @param onProfileChange - Callback when profile is saved
 */
export function ProfileSettingsDialog({
  open,
  onOpenChange,
  user,
  onProfileChange,
}: ProfileSettingsDialogProps) {
  // Form state
  const [name, setName] = useState(user.name ?? "");
  const [email, setEmail] = useState(user.email);

  // Password state
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);

  // Image state
  const [profileImage, setProfileImage] = useState<File | null>(null);
  const [heroImage, setHeroImage] = useState<File | null>(null);
  const [profileImagePreview, setProfileImagePreview] = useState<string | null>(
    null
  );
  const [heroImagePreview, setHeroImagePreview] = useState<string | null>(null);
  const [removeProfile, setRemoveProfile] = useState(false);
  const [removeHero, setRemoveHero] = useState(false);

  // Refs for file inputs
  const profileInputRef = useRef<HTMLInputElement>(null);
  const heroInputRef = useRef<HTMLInputElement>(null);

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
    setEmail(user.email);
    setCurrentPassword("");
    setNewPassword("");
    setConfirmPassword("");
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
    const emailChanged = email !== originalValues.email;
    const passwordChanging =
      newPassword.length > 0 || confirmPassword.length > 0;
    const profileImageChanging = profileImage !== null || removeProfile;
    const heroImageChanging = heroImage !== null || removeHero;

    return (
      nameChanged ||
      emailChanged ||
      passwordChanging ||
      profileImageChanging ||
      heroImageChanging
    );
  }, [
    name,
    email,
    newPassword,
    confirmPassword,
    profileImage,
    heroImage,
    removeProfile,
    removeHero,
    originalValues,
  ]);

  // Check if password is required (email change or password change)
  const isPasswordRequired = useMemo(() => {
    const emailChanged = email !== originalValues.email;
    const passwordChanging = newPassword.length > 0;
    return emailChanged || passwordChanging;
  }, [email, newPassword, originalValues.email]);

  /**
   * Handle profile image file selection.
   */
  const handleProfileImageChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (file) {
        setProfileImage(file);
        setRemoveProfile(false);
        // Create preview URL
        const url = URL.createObjectURL(file);
        setProfileImagePreview(url);
      }
    },
    []
  );

  /**
   * Handle hero image file selection.
   */
  const handleHeroImageChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (file) {
        setHeroImage(file);
        setRemoveHero(false);
        // Create preview URL
        const url = URL.createObjectURL(file);
        setHeroImagePreview(url);
      }
    },
    []
  );

  /**
   * Remove profile image.
   */
  const handleRemoveProfileImage = useCallback(() => {
    setProfileImage(null);
    setProfileImagePreview(null);
    setRemoveProfile(true);
    if (profileInputRef.current) {
      profileInputRef.current.value = "";
    }
  }, []);

  /**
   * Remove hero image.
   */
  const handleRemoveHeroImage = useCallback(() => {
    setHeroImage(null);
    setHeroImagePreview(null);
    setRemoveHero(true);
    if (heroInputRef.current) {
      heroInputRef.current.value = "";
    }
  }, []);

  /**
   * Resets form to original values.
   */
  const handleCancel = useCallback(() => {
    setName(originalValues.name);
    setEmail(originalValues.email);
    setCurrentPassword("");
    setNewPassword("");
    setConfirmPassword("");
    setProfileImage(null);
    setHeroImage(null);
    setProfileImagePreview(null);
    setHeroImagePreview(null);
    setRemoveProfile(false);
    setRemoveHero(false);
    onOpenChange(false);
  }, [originalValues, onOpenChange]);

  /**
   * Saves all changes.
   */
  const handleSave = useCallback(async () => {
    // Validation
    if (isPasswordRequired && !currentPassword) {
      toast.error("Current password required for email or password changes");
      return;
    }

    if (newPassword && newPassword !== confirmPassword) {
      toast.error("New passwords do not match");
      return;
    }

    setIsSaving(true);
    try {
      let hasError = false;

      // Update profile (name/email)
      const nameChanged = name !== originalValues.name;
      const emailChanged = email !== originalValues.email;

      if (nameChanged || emailChanged) {
        const result = await updateProfile({
          name: nameChanged ? name : undefined,
          email: emailChanged ? email : undefined,
          currentPassword: emailChanged ? currentPassword : undefined,
        });

        if (!result.success) {
          toast.error(result.error);
          hasError = true;
        }
      }

      // Change password
      if (newPassword && !hasError) {
        const result = await changePassword({
          currentPassword,
          newPassword,
        });

        if (!result.success) {
          toast.error(result.error);
          hasError = true;
        }
      }

      // Upload profile image
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

      // Upload hero image
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
        toast.success("Profile updated");
        await onProfileChange?.().catch(() => {});
        onOpenChange(false);
      }
    } catch {
      toast.error("Failed to update profile");
    } finally {
      setIsSaving(false);
    }
  }, [
    name,
    email,
    currentPassword,
    newPassword,
    confirmPassword,
    profileImage,
    heroImage,
    removeProfile,
    removeHero,
    originalValues,
    isPasswordRequired,
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

  // Determine profile image source
  const profileImageSrc = profileImagePreview
    ? profileImagePreview
    : !removeProfile && user.hasImage
      ? "/api/user/avatar"
      : null;

  // Determine hero image source
  const heroImageSrc = heroImagePreview
    ? heroImagePreview
    : !removeHero && user.hasHeroImage
      ? "/api/user/hero"
      : null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] max-w-[calc(100vw-2rem)] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <div className="flex items-center gap-3">
            <div
              className={cn(
                "flex size-10 shrink-0 items-center justify-center rounded-xl",
                "bg-primary/10 ring-primary/20 ring-1"
              )}
            >
              <User className="text-primary size-5" />
            </div>
            <div className="min-w-0">
              <DialogTitle className="text-lg">Profile Settings</DialogTitle>
              <DialogDescription className="text-sm">
                Manage your account
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <div className="min-w-0 space-y-6 py-2">
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

            <div className="flex items-center gap-4">
              <Avatar className="ring-offset-background ring-border size-16 ring-2 ring-offset-2">
                <AvatarImage src={profileImageSrc ?? undefined} />
                <AvatarFallback className="bg-muted text-muted-foreground">
                  {name?.[0]?.toUpperCase() ?? user.email[0].toUpperCase()}
                </AvatarFallback>
              </Avatar>

              <div className="flex gap-2">
                <input
                  ref={profileInputRef}
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  onChange={handleProfileImageChange}
                  className="hidden"
                />
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => profileInputRef.current?.click()}
                >
                  <Upload className="mr-1.5 size-3.5" />
                  Upload
                </Button>
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
              </div>
            </div>
            <p className="text-muted-foreground text-xs">
              JPEG, PNG, or WebP. Max 1MB.
            </p>
          </div>

          {/* Name Section */}
          <div className="space-y-3">
            <Label htmlFor="profile-name" className="text-sm font-medium">
              Display Name
            </Label>
            <Input
              id="profile-name"
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
              <Label htmlFor="profile-email" className="text-sm font-medium">
                Email
              </Label>
            </div>
            <Input
              id="profile-email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="h-10"
            />
            <p className="text-muted-foreground text-xs">
              Requires current password to change.
            </p>
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

            {/* Hero Preview */}
            <div
              className={cn(
                "relative h-24 overflow-hidden rounded-lg",
                "bg-muted ring-border ring-1"
              )}
            >
              {heroImageSrc ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={heroImageSrc}
                  alt="Hero preview"
                  className="size-full object-cover"
                />
              ) : (
                <div className="flex size-full items-center justify-center">
                  <Sparkles className="text-muted-foreground/30 size-8" />
                </div>
              )}
            </div>

            <div className="flex gap-2">
              <input
                ref={heroInputRef}
                type="file"
                accept="image/jpeg,image/png,image/webp"
                onChange={handleHeroImageChange}
                className="hidden"
              />
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => heroInputRef.current?.click()}
              >
                <Upload className="mr-1.5 size-3.5" />
                Upload Banner
              </Button>
              {(user.hasHeroImage || heroImage) && !removeHero && (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={handleRemoveHeroImage}
                >
                  <Trash2 className="mr-1.5 size-3.5" />
                  Remove
                </Button>
              )}
            </div>
            <p className="text-muted-foreground text-xs">
              Wide format recommended. Max 2MB.
            </p>
          </div>

          <Separator />

          {/* Password Section */}
          <div className="space-y-4">
            <div className="flex items-center gap-2">
              <div
                className={cn(
                  "flex size-7 items-center justify-center rounded-lg",
                  "bg-primary/10"
                )}
              >
                <Lock className="text-primary size-3.5" />
              </div>
              <Label className="text-sm font-medium">Change Password</Label>
            </div>

            <div className="space-y-3">
              <div className="space-y-2">
                <Label
                  htmlFor="current-password"
                  className="text-muted-foreground text-xs"
                >
                  Current Password
                  {isPasswordRequired && (
                    <span className="text-destructive ml-1">*</span>
                  )}
                </Label>
                <div className="relative">
                  <Input
                    id="current-password"
                    type={showCurrentPassword ? "text" : "password"}
                    value={currentPassword}
                    onChange={(e) => setCurrentPassword(e.target.value)}
                    className="h-10 pr-10"
                    placeholder={isPasswordRequired ? "Required" : "Optional"}
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="absolute top-1/2 right-1 size-8 -translate-y-1/2"
                    onClick={() => setShowCurrentPassword((p) => !p)}
                  >
                    {showCurrentPassword ? (
                      <EyeOff className="size-4" />
                    ) : (
                      <Eye className="size-4" />
                    )}
                  </Button>
                </div>
              </div>

              <div className="space-y-2">
                <Label
                  htmlFor="new-password"
                  className="text-muted-foreground text-xs"
                >
                  New Password
                </Label>
                <div className="relative">
                  <Input
                    id="new-password"
                    type={showNewPassword ? "text" : "password"}
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    className="h-10 pr-10"
                    placeholder="Leave blank to keep current"
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="absolute top-1/2 right-1 size-8 -translate-y-1/2"
                    onClick={() => setShowNewPassword((p) => !p)}
                  >
                    {showNewPassword ? (
                      <EyeOff className="size-4" />
                    ) : (
                      <Eye className="size-4" />
                    )}
                  </Button>
                </div>
              </div>

              <div className="space-y-2">
                <Label
                  htmlFor="confirm-password"
                  className="text-muted-foreground text-xs"
                >
                  Confirm New Password
                </Label>
                <Input
                  id="confirm-password"
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  className="h-10"
                  placeholder="Repeat new password"
                />
              </div>
            </div>

            <p className="text-muted-foreground text-xs">
              8+ characters with uppercase, lowercase, and number.
            </p>
          </div>
        </div>

        <DialogFooter className="gap-2 sm:gap-0">
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
      </DialogContent>
    </Dialog>
  );
}
