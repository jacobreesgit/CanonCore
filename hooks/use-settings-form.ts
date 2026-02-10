/**
 * Shared hook for settings dialog form state management.
 * Extracted from SettingsDialog to be reused by both the desktop dialog
 * and mobile settings sheet. Manages step navigation, password/email/username
 * changes, profile form fields, image uploads, dirty tracking, and public
 * profile confirmation.
 */

"use client";

import { useState, useCallback, useEffect, useMemo } from "react";
import { toast } from "sonner";
import { useUsernameValidation } from "@/hooks/use-username-validation";
import type { UsernameValidationState } from "@/hooks/use-username-validation";
import {
  updateProfile,
  uploadProfileImage,
  uploadHeroImage,
  removeProfileImage,
  removeHeroImage,
  changePassword,
} from "@/lib/user-actions";
import { passwordSchema, emailSchema } from "@/lib/validations";
import { SETTINGS_MESSAGES } from "@/lib/constants/messages";
import type { GoogleDriveConnection } from "@/lib/types";

/** Steps for settings dialog navigation. */
export type SettingsFormStep = "main" | "password" | "email" | "username";

/** User data required by the settings form. */
export interface SettingsFormUser {
  name: string | null;
  email: string;
  username: string | null;
  isPublic: boolean;
  hasImage: boolean;
  hasHeroImage: boolean;
}

/** Return type for the useSettingsForm hook. */
export interface UseSettingsFormReturn {
  // Step navigation
  currentStep: SettingsFormStep;
  setCurrentStep: (step: SettingsFormStep) => void;
  handleBack: () => void;

  // Password step
  currentPassword: string;
  setCurrentPassword: (value: string) => void;
  newPassword: string;
  setNewPassword: (value: string) => void;
  confirmPassword: string;
  setConfirmPassword: (value: string) => void;
  isPasswordSaving: boolean;
  handlePasswordSubmit: () => Promise<void>;

  // Email step
  newEmail: string;
  setNewEmail: (value: string) => void;
  emailPassword: string;
  setEmailPassword: (value: string) => void;
  isEmailSaving: boolean;
  handleEmailSubmit: () => Promise<void>;

  // Username step
  newUsername: string;
  setNewUsername: (value: string) => void;
  usernamePassword: string;
  setUsernamePassword: (value: string) => void;
  isUsernameSaving: boolean;
  usernameValidation: UsernameValidationState;
  handleUsernameSubmit: () => Promise<void>;

  // Main form
  name: string;
  setName: (value: string) => void;
  isPublic: boolean;
  setIsPublic: (value: boolean) => void;
  profileImage: File | null;
  heroImage: File | null;
  removeProfile: boolean;
  removeHero: boolean;
  profileImagePreview: string | null;
  heroImagePreview: string | null;
  isMainSaving: boolean;
  isDirty: boolean;

  // Public confirm
  showPublicConfirm: boolean;
  setShowPublicConfirm: (value: boolean) => void;
  handlePublicToggle: (checked: boolean) => void;
  handlePublicConfirm: () => void;

  // Image handlers
  handleProfileImageDrop: (acceptedFiles: File[]) => void;
  handleHeroImageDrop: (acceptedFiles: File[]) => void;
  handleRemoveProfileImage: () => void;
  handleRemoveHeroImage: () => void;

  // Main handlers
  handleMainSave: () => Promise<void>;
  handleMainCancel: () => void;

  // Computed
  profileImageSrc: string | null;
  heroImageSrc: string | null;

  // Reset function (called when dialog/sheet opens)
  resetForm: () => void;
}

/**
 * Manages all settings form state, shared between desktop SettingsDialog
 * and mobile settings sheet.
 *
 * @param user - Current user profile data
 * @param _googleDriveConnection - Google Drive connection (reserved for future use)
 * @param onProfileChange - Optional callback when profile is updated
 * @param onClose - Callback to close the dialog/sheet
 * @returns Form state, handlers, and step navigation
 */
export function useSettingsForm(
  user: SettingsFormUser,
  _googleDriveConnection: GoogleDriveConnection | null,
  onProfileChange?: () => Promise<void>,
  onClose?: () => void
): UseSettingsFormReturn {
  // Step navigation
  const [currentStep, setCurrentStep] = useState<SettingsFormStep>("main");

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

  // Username validation (for username change step)
  const usernameValidation = useUsernameValidation(newUsername, user.username);

  // Main step state
  const [name, setName] = useState(user.name ?? "");
  const [isPublic, setIsPublic] = useState(user.isPublic);
  const [profileImage, setProfileImage] = useState<File | null>(null);
  const [heroImage, setHeroImage] = useState<File | null>(null);
  const [showPublicConfirm, setShowPublicConfirm] = useState(false);
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

  // Cleanup preview URLs on unmount
  useEffect(() => {
    return () => {
      if (profileImagePreview) URL.revokeObjectURL(profileImagePreview);
      if (heroImagePreview) URL.revokeObjectURL(heroImagePreview);
    };
  }, [profileImagePreview, heroImagePreview]);

  /**
   * Resets all form state. Called when dialog/sheet opens.
   */
  const resetForm = useCallback(() => {
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
    setShowPublicConfirm(false);
  }, [user.name, user.email, user.username, user.isPublic]);

  /**
   * Navigates back to the main step.
   */
  const handleBack = useCallback(() => {
    setCurrentStep("main");
  }, []);

  // ---------------------------------------------------------------------------
  // Password handlers
  // ---------------------------------------------------------------------------

  /**
   * Validates and submits a password change.
   */
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

  // ---------------------------------------------------------------------------
  // Email handlers
  // ---------------------------------------------------------------------------

  /**
   * Validates and submits an email change.
   */
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

  // ---------------------------------------------------------------------------
  // Username handlers
  // ---------------------------------------------------------------------------

  /**
   * Validates and submits a username change.
   */
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

  // ---------------------------------------------------------------------------
  // Image handlers
  // ---------------------------------------------------------------------------

  /**
   * Handles profile image file drop.
   */
  const handleProfileImageDrop = useCallback((acceptedFiles: File[]) => {
    const file = acceptedFiles[0];
    if (file) {
      setProfileImage(file);
      setRemoveProfile(false);
      setProfileImagePreview(URL.createObjectURL(file));
    }
  }, []);

  /**
   * Handles hero image file drop.
   */
  const handleHeroImageDrop = useCallback((acceptedFiles: File[]) => {
    const file = acceptedFiles[0];
    if (file) {
      setHeroImage(file);
      setRemoveHero(false);
      setHeroImagePreview(URL.createObjectURL(file));
    }
  }, []);

  /**
   * Marks profile image for removal.
   */
  const handleRemoveProfileImage = useCallback(() => {
    setProfileImage(null);
    setProfileImagePreview(null);
    setRemoveProfile(true);
  }, []);

  /**
   * Marks hero image for removal.
   */
  const handleRemoveHeroImage = useCallback(() => {
    setHeroImage(null);
    setHeroImagePreview(null);
    setRemoveHero(true);
  }, []);

  // ---------------------------------------------------------------------------
  // Public profile handlers
  // ---------------------------------------------------------------------------

  /**
   * Handles public profile toggle with confirmation when enabling.
   */
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

  /**
   * Confirms enabling public profile.
   */
  const handlePublicConfirm = useCallback(() => {
    setIsPublic(true);
    setShowPublicConfirm(false);
  }, []);

  // ---------------------------------------------------------------------------
  // Main form handlers
  // ---------------------------------------------------------------------------

  /**
   * Resets form to original values and closes the dialog/sheet.
   */
  const handleMainCancel = useCallback(() => {
    setName(originalValues.name);
    setIsPublic(originalValues.isPublic);
    setProfileImage(null);
    setHeroImage(null);
    setProfileImagePreview(null);
    setHeroImagePreview(null);
    setRemoveProfile(false);
    setRemoveHero(false);
    onClose?.();
  }, [originalValues, onClose]);

  /**
   * Saves all main form changes (name, public, images).
   */
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
        onClose?.();
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
    onClose,
  ]);

  // ---------------------------------------------------------------------------
  // Computed image sources
  // ---------------------------------------------------------------------------

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

  return {
    // Step navigation
    currentStep,
    setCurrentStep,
    handleBack,

    // Password step
    currentPassword,
    setCurrentPassword,
    newPassword,
    setNewPassword,
    confirmPassword,
    setConfirmPassword,
    isPasswordSaving,
    handlePasswordSubmit,

    // Email step
    newEmail,
    setNewEmail,
    emailPassword,
    setEmailPassword,
    isEmailSaving,
    handleEmailSubmit,

    // Username step
    newUsername,
    setNewUsername,
    usernamePassword,
    setUsernamePassword,
    isUsernameSaving,
    usernameValidation,
    handleUsernameSubmit,

    // Main form
    name,
    setName,
    isPublic,
    setIsPublic,
    profileImage,
    heroImage,
    removeProfile,
    removeHero,
    profileImagePreview,
    heroImagePreview,
    isMainSaving,
    isDirty,

    // Public confirm
    showPublicConfirm,
    setShowPublicConfirm,
    handlePublicToggle,
    handlePublicConfirm,

    // Image handlers
    handleProfileImageDrop,
    handleHeroImageDrop,
    handleRemoveProfileImage,
    handleRemoveHeroImage,

    // Main handlers
    handleMainSave,
    handleMainCancel,

    // Computed
    profileImageSrc,
    heroImageSrc,

    // Reset
    resetForm,
  };
}
