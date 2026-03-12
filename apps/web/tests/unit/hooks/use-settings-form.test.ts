/**
 * Unit tests for useSettingsForm hook.
 * Covers step navigation, password/email change, dirty tracking,
 * cancel/reset, public profile toggle, and image handlers.
 */

import { renderHook, act } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import type { SettingsFormUser } from "@/hooks/use-settings-form";

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

const mockUpdateProfile = vi.fn().mockResolvedValue({ success: true });
const mockChangePassword = vi.fn().mockResolvedValue({ success: true });
const mockUploadProfileImage = vi.fn().mockResolvedValue({ success: true });
const mockUploadHeroImage = vi.fn().mockResolvedValue({ success: true });
const mockRemoveProfileImage = vi.fn().mockResolvedValue({ success: true });
const mockRemoveHeroImage = vi.fn().mockResolvedValue({ success: true });

vi.mock("@/lib/user-actions", () => ({
  updateProfile: (...args: unknown[]) => mockUpdateProfile(...args),
  changePassword: (...args: unknown[]) => mockChangePassword(...args),
  uploadProfileImage: (...args: unknown[]) => mockUploadProfileImage(...args),
  uploadHeroImage: (...args: unknown[]) => mockUploadHeroImage(...args),
  removeProfileImage: (...args: unknown[]) => mockRemoveProfileImage(...args),
  removeHeroImage: (...args: unknown[]) => mockRemoveHeroImage(...args),
}));

vi.mock("@/lib/validations", () => ({
  passwordSchema: { safeParse: vi.fn().mockReturnValue({ success: true }) },
  emailSchema: { safeParse: vi.fn().mockReturnValue({ success: true }) },
}));

let mockUsernameValidation = {
  isValidFormat: true,
  isAvailable: true as boolean | null,
  isChecking: false,
  isValidating: false,
  error: null as string | null,
  success: null as string | null,
};

vi.mock("@/hooks/use-username-validation", () => ({
  useUsernameValidation: () => mockUsernameValidation,
}));

vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

global.URL.createObjectURL = vi.fn(() => "blob:test");
global.URL.revokeObjectURL = vi.fn();

const mockUser: SettingsFormUser = {
  name: "Test User",
  email: "test@example.com",
  username: "testuser",
  isPublic: false,
  hasImage: false,
  hasHeroImage: false,
  bio: null,
};

async function importHook() {
  const { useSettingsForm } = await import("@/hooks/use-settings-form");
  return useSettingsForm;
}

async function importToast() {
  const { toast } = await import("sonner");
  return toast;
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("useSettingsForm", () => {
  let useSettingsForm: Awaited<ReturnType<typeof importHook>>;
  let toast: Awaited<ReturnType<typeof importToast>>;

  beforeEach(async () => {
    vi.clearAllMocks();
    // Reset username validation to default valid state
    mockUsernameValidation = {
      isValidFormat: true,
      isAvailable: true,
      isChecking: false,
      isValidating: false,
      error: null,
      success: null,
    };
    useSettingsForm = await importHook();
    toast = await importToast();
  });

  // -------------------------------------------------------------------------
  // Step navigation
  // -------------------------------------------------------------------------

  describe("step navigation", () => {
    it("starts at main step", () => {
      const { result } = renderHook(() =>
        useSettingsForm(mockUser, null, undefined, undefined)
      );
      expect(result.current.currentStep).toBe("main");
    });

    it("navigates to password step", () => {
      const { result } = renderHook(() =>
        useSettingsForm(mockUser, null, undefined, undefined)
      );
      act(() => {
        result.current.setCurrentStep("password");
      });
      expect(result.current.currentStep).toBe("password");
    });

    it("navigates back to main from password", () => {
      const { result } = renderHook(() =>
        useSettingsForm(mockUser, null, undefined, undefined)
      );
      act(() => {
        result.current.setCurrentStep("password");
      });
      expect(result.current.currentStep).toBe("password");

      act(() => {
        result.current.handleBack();
      });
      expect(result.current.currentStep).toBe("main");
    });

    it("navigates to email step", () => {
      const { result } = renderHook(() =>
        useSettingsForm(mockUser, null, undefined, undefined)
      );
      act(() => {
        result.current.setCurrentStep("email");
      });
      expect(result.current.currentStep).toBe("email");
    });

    it("navigates to username step", () => {
      const { result } = renderHook(() =>
        useSettingsForm(mockUser, null, undefined, undefined)
      );
      act(() => {
        result.current.setCurrentStep("username");
      });
      expect(result.current.currentStep).toBe("username");
    });
  });

  // -------------------------------------------------------------------------
  // Password change
  // -------------------------------------------------------------------------

  describe("password change", () => {
    it("shows error when fields are empty", async () => {
      const { result } = renderHook(() =>
        useSettingsForm(mockUser, null, undefined, undefined)
      );

      await act(async () => {
        await result.current.handlePasswordSubmit();
      });

      expect(toast.error).toHaveBeenCalledWith("All fields are required");
    });

    it("shows error on password mismatch", async () => {
      const { result } = renderHook(() =>
        useSettingsForm(mockUser, null, undefined, undefined)
      );

      act(() => {
        result.current.setCurrentPassword("OldPassword1");
        result.current.setNewPassword("NewPassword1");
        result.current.setConfirmPassword("DifferentPassword1");
      });

      await act(async () => {
        await result.current.handlePasswordSubmit();
      });

      expect(toast.error).toHaveBeenCalledWith("New passwords do not match");
    });

    it("calls changePassword on valid submit", async () => {
      const { result } = renderHook(() =>
        useSettingsForm(mockUser, null, undefined, undefined)
      );

      act(() => {
        result.current.setCurrentPassword("OldPassword1");
        result.current.setNewPassword("NewPassword1");
        result.current.setConfirmPassword("NewPassword1");
      });

      await act(async () => {
        await result.current.handlePasswordSubmit();
      });

      expect(mockChangePassword).toHaveBeenCalledWith({
        currentPassword: "OldPassword1",
        newPassword: "NewPassword1",
      });
    });

    it("returns to main step after success", async () => {
      const { result } = renderHook(() =>
        useSettingsForm(mockUser, null, undefined, undefined)
      );

      act(() => {
        result.current.setCurrentStep("password");
        result.current.setCurrentPassword("OldPassword1");
        result.current.setNewPassword("NewPassword1");
        result.current.setConfirmPassword("NewPassword1");
      });

      await act(async () => {
        await result.current.handlePasswordSubmit();
      });

      expect(result.current.currentStep).toBe("main");
    });

    it("clears password fields after success", async () => {
      const { result } = renderHook(() =>
        useSettingsForm(mockUser, null, undefined, undefined)
      );

      act(() => {
        result.current.setCurrentPassword("OldPassword1");
        result.current.setNewPassword("NewPassword1");
        result.current.setConfirmPassword("NewPassword1");
      });

      await act(async () => {
        await result.current.handlePasswordSubmit();
      });

      expect(result.current.currentPassword).toBe("");
      expect(result.current.newPassword).toBe("");
      expect(result.current.confirmPassword).toBe("");
    });
  });

  // -------------------------------------------------------------------------
  // Email change
  // -------------------------------------------------------------------------

  describe("email change", () => {
    it("shows error when fields are empty", async () => {
      const { result } = renderHook(() =>
        useSettingsForm(mockUser, null, undefined, undefined)
      );

      await act(async () => {
        await result.current.handleEmailSubmit();
      });

      expect(toast.error).toHaveBeenCalledWith("All fields are required");
    });

    it("shows error when email unchanged", async () => {
      const { result } = renderHook(() =>
        useSettingsForm(mockUser, null, undefined, undefined)
      );

      act(() => {
        result.current.setEmailPassword("Password1");
      });

      await act(async () => {
        await result.current.handleEmailSubmit();
      });

      expect(toast.error).toHaveBeenCalledWith(
        "New email must be different from current email"
      );
    });

    it("calls updateProfile on valid submit", async () => {
      const { result } = renderHook(() =>
        useSettingsForm(mockUser, null, undefined, undefined)
      );

      act(() => {
        result.current.setNewEmail("new@example.com");
        result.current.setEmailPassword("Password1");
      });

      await act(async () => {
        await result.current.handleEmailSubmit();
      });

      expect(mockUpdateProfile).toHaveBeenCalledWith({
        email: "new@example.com",
        currentPassword: "Password1",
      });
    });
  });

  // -------------------------------------------------------------------------
  // Profile form - dirty tracking
  // -------------------------------------------------------------------------

  describe("profile form - dirty tracking", () => {
    it("starts not dirty", () => {
      const { result } = renderHook(() =>
        useSettingsForm(mockUser, null, undefined, undefined)
      );
      expect(result.current.isDirty).toBe(false);
    });

    it("is dirty when name changes", () => {
      const { result } = renderHook(() =>
        useSettingsForm(mockUser, null, undefined, undefined)
      );
      act(() => {
        result.current.setName("New Name");
      });
      expect(result.current.isDirty).toBe(true);
    });

    it("is dirty when isPublic changes", () => {
      const { result } = renderHook(() =>
        useSettingsForm(mockUser, null, undefined, undefined)
      );
      act(() => {
        result.current.setIsPublic(true);
      });
      expect(result.current.isDirty).toBe(true);
    });

    it("is dirty when profile image set", () => {
      const { result } = renderHook(() =>
        useSettingsForm(mockUser, null, undefined, undefined)
      );
      act(() => {
        const file = new File(["data"], "test.jpg", { type: "image/jpeg" });
        result.current.handleProfileImageDrop([file]);
      });
      expect(result.current.isDirty).toBe(true);
    });

    it("is dirty when hero image set", () => {
      const { result } = renderHook(() =>
        useSettingsForm(mockUser, null, undefined, undefined)
      );
      act(() => {
        const file = new File(["data"], "test.jpg", { type: "image/jpeg" });
        result.current.handleHeroImageDrop([file]);
      });
      expect(result.current.isDirty).toBe(true);
    });

    it("is dirty when remove profile image", () => {
      const { result } = renderHook(() =>
        useSettingsForm(mockUser, null, undefined, undefined)
      );
      act(() => {
        result.current.handleRemoveProfileImage();
      });
      expect(result.current.isDirty).toBe(true);
    });
  });

  // -------------------------------------------------------------------------
  // Cancel
  // -------------------------------------------------------------------------

  describe("cancel", () => {
    it("reverts name to original", () => {
      const { result } = renderHook(() =>
        useSettingsForm(mockUser, null, undefined, undefined)
      );

      act(() => {
        result.current.setName("Changed Name");
      });
      expect(result.current.name).toBe("Changed Name");

      act(() => {
        result.current.handleMainCancel();
      });
      expect(result.current.name).toBe("Test User");
    });

    it("calls onClose", () => {
      const onClose = vi.fn();
      const { result } = renderHook(() =>
        useSettingsForm(mockUser, null, undefined, onClose)
      );

      act(() => {
        result.current.handleMainCancel();
      });
      expect(onClose).toHaveBeenCalled();
    });
  });

  // -------------------------------------------------------------------------
  // Public profile toggle
  // -------------------------------------------------------------------------

  describe("public profile toggle", () => {
    it("shows confirmation when enabling public", () => {
      const { result } = renderHook(() =>
        useSettingsForm(mockUser, null, undefined, undefined)
      );

      act(() => {
        result.current.handlePublicToggle(true);
      });

      expect(result.current.showPublicConfirm).toBe(true);
      expect(result.current.isPublic).toBe(false);
    });

    it("sets public after confirmation", () => {
      const { result } = renderHook(() =>
        useSettingsForm(mockUser, null, undefined, undefined)
      );

      act(() => {
        result.current.handlePublicToggle(true);
      });
      expect(result.current.showPublicConfirm).toBe(true);

      act(() => {
        result.current.handlePublicConfirm();
      });
      expect(result.current.isPublic).toBe(true);
      expect(result.current.showPublicConfirm).toBe(false);
    });

    it("allows immediate toggle when disabling", () => {
      const publicUser: SettingsFormUser = { ...mockUser, isPublic: true };
      const { result } = renderHook(() =>
        useSettingsForm(publicUser, null, undefined, undefined)
      );

      act(() => {
        result.current.handlePublicToggle(false);
      });
      expect(result.current.isPublic).toBe(false);
    });
  });

  // -------------------------------------------------------------------------
  // resetForm
  // -------------------------------------------------------------------------

  describe("resetForm", () => {
    it("resets all state", () => {
      const { result } = renderHook(() =>
        useSettingsForm(mockUser, null, undefined, undefined)
      );

      // Change several things
      act(() => {
        result.current.setCurrentStep("password");
        result.current.setName("Different Name");
        const file = new File(["data"], "test.jpg", { type: "image/jpeg" });
        result.current.handleProfileImageDrop([file]);
      });

      expect(result.current.currentStep).toBe("password");
      expect(result.current.name).toBe("Different Name");
      expect(result.current.isDirty).toBe(true);

      act(() => {
        result.current.resetForm();
      });

      expect(result.current.currentStep).toBe("main");
      expect(result.current.name).toBe("Test User");
      expect(result.current.profileImage).toBeNull();
      expect(result.current.profileImagePreview).toBeNull();
      expect(result.current.isDirty).toBe(false);
    });
  });

  // -------------------------------------------------------------------------
  // handleMainSave — full save flow
  // -------------------------------------------------------------------------

  describe("handleMainSave", () => {
    it("saves name/bio/isPublic changes via updateProfile (only changed fields)", async () => {
      const onProfileChange = vi.fn().mockResolvedValue(undefined);
      const onClose = vi.fn();
      const { result } = renderHook(() =>
        useSettingsForm(mockUser, null, onProfileChange, onClose)
      );

      act(() => {
        result.current.setName("New Name");
        result.current.setBio("New bio text");
        result.current.setIsPublic(true);
      });

      await act(async () => {
        await result.current.handleMainSave();
      });

      expect(mockUpdateProfile).toHaveBeenCalledWith({
        name: "New Name",
        bio: "New bio text",
        isPublic: true,
      });
      expect(toast.success).toHaveBeenCalledWith("Settings saved");
      expect(onProfileChange).toHaveBeenCalled();
      expect(onClose).toHaveBeenCalled();
    });

    it("only sends changed fields to updateProfile", async () => {
      const { result } = renderHook(() =>
        useSettingsForm(mockUser, null, undefined, undefined)
      );

      // Only change name, not bio or isPublic
      act(() => {
        result.current.setName("Changed Name");
      });

      await act(async () => {
        await result.current.handleMainSave();
      });

      expect(mockUpdateProfile).toHaveBeenCalledWith({ name: "Changed Name" });
    });

    it("does not call updateProfile when no profile fields changed", async () => {
      const { result } = renderHook(() =>
        useSettingsForm(mockUser, null, undefined, undefined)
      );

      // Only add profile image, no name/bio/isPublic changes
      act(() => {
        const file = new File(["data"], "avatar.jpg", { type: "image/jpeg" });
        result.current.handleProfileImageDrop([file]);
      });

      await act(async () => {
        await result.current.handleMainSave();
      });

      expect(mockUpdateProfile).not.toHaveBeenCalled();
      expect(mockUploadProfileImage).toHaveBeenCalled();
    });

    it("uploads profile image via uploadProfileImage", async () => {
      const { result } = renderHook(() =>
        useSettingsForm(mockUser, null, undefined, undefined)
      );

      act(() => {
        const file = new File(["imgdata"], "avatar.png", {
          type: "image/png",
        });
        result.current.handleProfileImageDrop([file]);
      });

      await act(async () => {
        await result.current.handleMainSave();
      });

      expect(mockUploadProfileImage).toHaveBeenCalledTimes(1);
      const formData = mockUploadProfileImage.mock.calls[0][0] as FormData;
      expect(formData.get("file")).toBeInstanceOf(File);
    });

    it("uploads hero image via uploadHeroImage", async () => {
      const { result } = renderHook(() =>
        useSettingsForm(mockUser, null, undefined, undefined)
      );

      act(() => {
        const file = new File(["herodata"], "hero.png", {
          type: "image/png",
        });
        result.current.handleHeroImageDrop([file]);
      });

      await act(async () => {
        await result.current.handleMainSave();
      });

      expect(mockUploadHeroImage).toHaveBeenCalledTimes(1);
      const formData = mockUploadHeroImage.mock.calls[0][0] as FormData;
      expect(formData.get("file")).toBeInstanceOf(File);
    });

    it("removes profile image via removeProfileImage", async () => {
      const userWithImage: SettingsFormUser = {
        ...mockUser,
        hasImage: true,
      };
      const { result } = renderHook(() =>
        useSettingsForm(userWithImage, null, undefined, undefined)
      );

      act(() => {
        result.current.handleRemoveProfileImage();
      });

      await act(async () => {
        await result.current.handleMainSave();
      });

      expect(mockRemoveProfileImage).toHaveBeenCalledTimes(1);
    });

    it("removes hero image via removeHeroImage", async () => {
      const userWithHero: SettingsFormUser = {
        ...mockUser,
        hasHeroImage: true,
      };
      const { result } = renderHook(() =>
        useSettingsForm(userWithHero, null, undefined, undefined)
      );

      act(() => {
        result.current.handleRemoveHeroImage();
      });

      await act(async () => {
        await result.current.handleMainSave();
      });

      expect(mockRemoveHeroImage).toHaveBeenCalledTimes(1);
    });

    it("stops on first error from updateProfile", async () => {
      mockUpdateProfile.mockResolvedValueOnce({
        success: false,
        error: "Name too long",
      });

      const { result } = renderHook(() =>
        useSettingsForm(mockUser, null, undefined, undefined)
      );

      act(() => {
        result.current.setName("New Name");
        const file = new File(["data"], "avatar.png", {
          type: "image/png",
        });
        result.current.handleProfileImageDrop([file]);
      });

      await act(async () => {
        await result.current.handleMainSave();
      });

      expect(toast.error).toHaveBeenCalledWith("Name too long");
      // Should not proceed to upload
      expect(mockUploadProfileImage).not.toHaveBeenCalled();
      expect(toast.success).not.toHaveBeenCalled();
    });

    it("stops on first error from uploadProfileImage", async () => {
      mockUploadProfileImage.mockResolvedValueOnce({
        success: false,
        error: "File too large",
      });

      const { result } = renderHook(() =>
        useSettingsForm(mockUser, null, undefined, undefined)
      );

      act(() => {
        const profileFile = new File(["p"], "avatar.png", {
          type: "image/png",
        });
        result.current.handleProfileImageDrop([profileFile]);
        const heroFile = new File(["h"], "hero.png", { type: "image/png" });
        result.current.handleHeroImageDrop([heroFile]);
      });

      await act(async () => {
        await result.current.handleMainSave();
      });

      expect(toast.error).toHaveBeenCalledWith("File too large");
      // Should not proceed to hero upload
      expect(mockUploadHeroImage).not.toHaveBeenCalled();
      expect(toast.success).not.toHaveBeenCalled();
    });

    it("stops on first error from uploadHeroImage", async () => {
      mockUploadHeroImage.mockResolvedValueOnce({
        success: false,
        error: "Hero upload failed",
      });

      const { result } = renderHook(() =>
        useSettingsForm(mockUser, null, undefined, undefined)
      );

      act(() => {
        const file = new File(["h"], "hero.png", { type: "image/png" });
        result.current.handleHeroImageDrop([file]);
      });

      await act(async () => {
        await result.current.handleMainSave();
      });

      expect(toast.error).toHaveBeenCalledWith("Hero upload failed");
      expect(toast.success).not.toHaveBeenCalled();
    });

    it("stops on error from removeProfileImage", async () => {
      mockRemoveProfileImage.mockResolvedValueOnce({
        success: false,
        error: "Remove failed",
      });

      const { result } = renderHook(() =>
        useSettingsForm(
          { ...mockUser, hasImage: true },
          null,
          undefined,
          undefined
        )
      );

      act(() => {
        result.current.handleRemoveProfileImage();
        // Also set hero image to verify it doesn't proceed
        const file = new File(["h"], "hero.png", { type: "image/png" });
        result.current.handleHeroImageDrop([file]);
      });

      await act(async () => {
        await result.current.handleMainSave();
      });

      expect(toast.error).toHaveBeenCalledWith("Remove failed");
      expect(mockUploadHeroImage).not.toHaveBeenCalled();
    });

    it("stops on error from removeHeroImage", async () => {
      mockRemoveHeroImage.mockResolvedValueOnce({
        success: false,
        error: "Hero remove failed",
      });

      const { result } = renderHook(() =>
        useSettingsForm(
          { ...mockUser, hasHeroImage: true },
          null,
          undefined,
          undefined
        )
      );

      act(() => {
        result.current.handleRemoveHeroImage();
      });

      await act(async () => {
        await result.current.handleMainSave();
      });

      expect(toast.error).toHaveBeenCalledWith("Hero remove failed");
      expect(toast.success).not.toHaveBeenCalled();
    });

    it("handles exception with catch toast", async () => {
      mockUpdateProfile.mockRejectedValueOnce(new Error("Network error"));

      const { result } = renderHook(() =>
        useSettingsForm(mockUser, null, undefined, undefined)
      );

      act(() => {
        result.current.setName("New Name");
      });

      await act(async () => {
        await result.current.handleMainSave();
      });

      expect(toast.error).toHaveBeenCalledWith("Failed to update settings");
    });

    it("resets isMainSaving after success", async () => {
      const { result } = renderHook(() =>
        useSettingsForm(mockUser, null, undefined, undefined)
      );

      act(() => {
        result.current.setName("New Name");
      });

      await act(async () => {
        await result.current.handleMainSave();
      });

      expect(result.current.isMainSaving).toBe(false);
    });

    it("resets isMainSaving after failure", async () => {
      mockUpdateProfile.mockRejectedValueOnce(new Error("fail"));

      const { result } = renderHook(() =>
        useSettingsForm(mockUser, null, undefined, undefined)
      );

      act(() => {
        result.current.setName("New Name");
      });

      await act(async () => {
        await result.current.handleMainSave();
      });

      expect(result.current.isMainSaving).toBe(false);
    });

    it("handles onProfileChange rejection gracefully", async () => {
      const onProfileChange = vi
        .fn()
        .mockRejectedValue(new Error("refresh failed"));
      const onClose = vi.fn();
      const { result } = renderHook(() =>
        useSettingsForm(mockUser, null, onProfileChange, onClose)
      );

      act(() => {
        result.current.setName("New Name");
      });

      await act(async () => {
        await result.current.handleMainSave();
      });

      // Should still succeed and close despite onProfileChange rejection
      expect(toast.success).toHaveBeenCalledWith("Settings saved");
      expect(onClose).toHaveBeenCalled();
    });
  });

  // -------------------------------------------------------------------------
  // handleEmailSubmit — error paths
  // -------------------------------------------------------------------------

  describe("handleEmailSubmit — error handling", () => {
    it("shows error on server action failure", async () => {
      mockUpdateProfile.mockResolvedValueOnce({
        success: false,
        error: "Email already in use",
      });

      const { result } = renderHook(() =>
        useSettingsForm(mockUser, null, undefined, undefined)
      );

      act(() => {
        result.current.setNewEmail("taken@example.com");
        result.current.setEmailPassword("Password1");
      });

      await act(async () => {
        await result.current.handleEmailSubmit();
      });

      expect(toast.error).toHaveBeenCalledWith("Email already in use");
    });

    it("handles exception with catch toast", async () => {
      mockUpdateProfile.mockRejectedValueOnce(new Error("Network error"));

      const { result } = renderHook(() =>
        useSettingsForm(mockUser, null, undefined, undefined)
      );

      act(() => {
        result.current.setNewEmail("new@example.com");
        result.current.setEmailPassword("Password1");
      });

      await act(async () => {
        await result.current.handleEmailSubmit();
      });

      expect(toast.error).toHaveBeenCalledWith("Failed to change email");
    });

    it("calls onProfileChange after success", async () => {
      const onProfileChange = vi.fn().mockResolvedValue(undefined);
      const { result } = renderHook(() =>
        useSettingsForm(mockUser, null, onProfileChange, undefined)
      );

      act(() => {
        result.current.setNewEmail("new@example.com");
        result.current.setEmailPassword("Password1");
      });

      await act(async () => {
        await result.current.handleEmailSubmit();
      });

      expect(onProfileChange).toHaveBeenCalled();
    });

    it("returns to main step after success", async () => {
      const { result } = renderHook(() =>
        useSettingsForm(mockUser, null, undefined, undefined)
      );

      act(() => {
        result.current.setCurrentStep("email");
        result.current.setNewEmail("new@example.com");
        result.current.setEmailPassword("Password1");
      });

      await act(async () => {
        await result.current.handleEmailSubmit();
      });

      expect(result.current.currentStep).toBe("main");
    });

    it("resets isEmailSaving after success", async () => {
      const { result } = renderHook(() =>
        useSettingsForm(mockUser, null, undefined, undefined)
      );

      act(() => {
        result.current.setNewEmail("new@example.com");
        result.current.setEmailPassword("Password1");
      });

      await act(async () => {
        await result.current.handleEmailSubmit();
      });

      expect(result.current.isEmailSaving).toBe(false);
    });

    it("resets isEmailSaving after failure", async () => {
      mockUpdateProfile.mockRejectedValueOnce(new Error("fail"));

      const { result } = renderHook(() =>
        useSettingsForm(mockUser, null, undefined, undefined)
      );

      act(() => {
        result.current.setNewEmail("new@example.com");
        result.current.setEmailPassword("Password1");
      });

      await act(async () => {
        await result.current.handleEmailSubmit();
      });

      expect(result.current.isEmailSaving).toBe(false);
    });

    it("shows error on invalid email format", async () => {
      const { emailSchema } = await import("@/lib/validations");
      vi.mocked(emailSchema.safeParse).mockReturnValueOnce({
        success: false,
        error: { issues: [{ message: "Invalid email" }] },
      } as never);

      const { result } = renderHook(() =>
        useSettingsForm(mockUser, null, undefined, undefined)
      );

      act(() => {
        result.current.setNewEmail("not-an-email");
        result.current.setEmailPassword("Password1");
      });

      await act(async () => {
        await result.current.handleEmailSubmit();
      });

      expect(toast.error).toHaveBeenCalledWith("Invalid email format");
    });
  });

  // -------------------------------------------------------------------------
  // handlePasswordSubmit — Zod validation & error paths
  // -------------------------------------------------------------------------

  describe("handlePasswordSubmit — validation & error paths", () => {
    it("shows Zod validation error when password is too weak", async () => {
      const { passwordSchema } = await import("@/lib/validations");
      vi.mocked(passwordSchema.safeParse).mockReturnValueOnce({
        success: false,
        error: { issues: [{ message: "Password must contain uppercase" }] },
      } as never);

      const { result } = renderHook(() =>
        useSettingsForm(mockUser, null, undefined, undefined)
      );

      act(() => {
        result.current.setCurrentPassword("OldPassword1");
        result.current.setNewPassword("weak");
        result.current.setConfirmPassword("weak");
      });

      await act(async () => {
        await result.current.handlePasswordSubmit();
      });

      expect(toast.error).toHaveBeenCalledWith(
        "Password must contain uppercase"
      );
      expect(mockChangePassword).not.toHaveBeenCalled();
    });

    it("shows error on server action failure", async () => {
      mockChangePassword.mockResolvedValueOnce({
        success: false,
        error: "Current password is incorrect",
      });

      const { result } = renderHook(() =>
        useSettingsForm(mockUser, null, undefined, undefined)
      );

      act(() => {
        result.current.setCurrentPassword("WrongPassword1");
        result.current.setNewPassword("NewPassword1");
        result.current.setConfirmPassword("NewPassword1");
      });

      await act(async () => {
        await result.current.handlePasswordSubmit();
      });

      expect(toast.error).toHaveBeenCalledWith("Current password is incorrect");
    });

    it("handles exception with catch toast", async () => {
      mockChangePassword.mockRejectedValueOnce(new Error("Network error"));

      const { result } = renderHook(() =>
        useSettingsForm(mockUser, null, undefined, undefined)
      );

      act(() => {
        result.current.setCurrentPassword("OldPassword1");
        result.current.setNewPassword("NewPassword1");
        result.current.setConfirmPassword("NewPassword1");
      });

      await act(async () => {
        await result.current.handlePasswordSubmit();
      });

      expect(toast.error).toHaveBeenCalledWith("Failed to change password");
    });

    it("resets isPasswordSaving after success", async () => {
      const { result } = renderHook(() =>
        useSettingsForm(mockUser, null, undefined, undefined)
      );

      act(() => {
        result.current.setCurrentPassword("OldPassword1");
        result.current.setNewPassword("NewPassword1");
        result.current.setConfirmPassword("NewPassword1");
      });

      await act(async () => {
        await result.current.handlePasswordSubmit();
      });

      expect(result.current.isPasswordSaving).toBe(false);
    });

    it("resets isPasswordSaving after failure", async () => {
      mockChangePassword.mockRejectedValueOnce(new Error("fail"));

      const { result } = renderHook(() =>
        useSettingsForm(mockUser, null, undefined, undefined)
      );

      act(() => {
        result.current.setCurrentPassword("OldPassword1");
        result.current.setNewPassword("NewPassword1");
        result.current.setConfirmPassword("NewPassword1");
      });

      await act(async () => {
        await result.current.handlePasswordSubmit();
      });

      expect(result.current.isPasswordSaving).toBe(false);
    });

    it("shows success toast on password change", async () => {
      const { result } = renderHook(() =>
        useSettingsForm(mockUser, null, undefined, undefined)
      );

      act(() => {
        result.current.setCurrentPassword("OldPassword1");
        result.current.setNewPassword("NewPassword1");
        result.current.setConfirmPassword("NewPassword1");
      });

      await act(async () => {
        await result.current.handlePasswordSubmit();
      });

      expect(toast.success).toHaveBeenCalledWith("Password saved");
    });
  });

  // -------------------------------------------------------------------------
  // handleUsernameSubmit — full username change flow
  // -------------------------------------------------------------------------

  describe("handleUsernameSubmit", () => {
    it("shows error when fields are empty", async () => {
      const { result } = renderHook(() =>
        useSettingsForm(mockUser, null, undefined, undefined)
      );

      // Clear the username (it defaults to mockUser.username)
      act(() => {
        result.current.setNewUsername("");
      });

      await act(async () => {
        await result.current.handleUsernameSubmit();
      });

      expect(toast.error).toHaveBeenCalledWith("All fields are required");
    });

    it("shows error when password is empty", async () => {
      const { result } = renderHook(() =>
        useSettingsForm(mockUser, null, undefined, undefined)
      );

      act(() => {
        result.current.setNewUsername("newuser");
        // usernamePassword starts as ""
      });

      await act(async () => {
        await result.current.handleUsernameSubmit();
      });

      expect(toast.error).toHaveBeenCalledWith("All fields are required");
    });

    it("shows error when format is invalid", async () => {
      mockUsernameValidation = {
        isValidFormat: false,
        isAvailable: null,
        isChecking: false,
        isValidating: false,
        error: "Username can only contain lowercase letters",
        success: null,
      };

      const { result } = renderHook(() =>
        useSettingsForm(mockUser, null, undefined, undefined)
      );

      act(() => {
        result.current.setNewUsername("INVALID!");
        result.current.setUsernamePassword("Password1");
      });

      await act(async () => {
        await result.current.handleUsernameSubmit();
      });

      expect(toast.error).toHaveBeenCalledWith(
        "Username can only contain lowercase letters"
      );
      expect(mockUpdateProfile).not.toHaveBeenCalled();
    });

    it("shows fallback error when format is invalid but no error message", async () => {
      mockUsernameValidation = {
        isValidFormat: false,
        isAvailable: null,
        isChecking: false,
        isValidating: false,
        error: null,
        success: null,
      };

      const { result } = renderHook(() =>
        useSettingsForm(mockUser, null, undefined, undefined)
      );

      act(() => {
        result.current.setNewUsername("bad");
        result.current.setUsernamePassword("Password1");
      });

      await act(async () => {
        await result.current.handleUsernameSubmit();
      });

      expect(toast.error).toHaveBeenCalledWith("Invalid username format");
    });

    it("shows error when username is taken", async () => {
      mockUsernameValidation = {
        isValidFormat: true,
        isAvailable: false,
        isChecking: false,
        isValidating: false,
        error: "Username is already taken",
        success: null,
      };

      const { result } = renderHook(() =>
        useSettingsForm(mockUser, null, undefined, undefined)
      );

      act(() => {
        result.current.setNewUsername("takenuser");
        result.current.setUsernamePassword("Password1");
      });

      await act(async () => {
        await result.current.handleUsernameSubmit();
      });

      expect(toast.error).toHaveBeenCalledWith("Username is already taken");
      expect(mockUpdateProfile).not.toHaveBeenCalled();
    });

    it("shows error when username is same as current", async () => {
      const { result } = renderHook(() =>
        useSettingsForm(mockUser, null, undefined, undefined)
      );

      act(() => {
        result.current.setNewUsername("testuser"); // same as mockUser.username
        result.current.setUsernamePassword("Password1");
      });

      await act(async () => {
        await result.current.handleUsernameSubmit();
      });

      expect(toast.error).toHaveBeenCalledWith(
        "New username must be different from current username"
      );
      expect(mockUpdateProfile).not.toHaveBeenCalled();
    });

    it("calls updateProfile with username and password on success", async () => {
      const onProfileChange = vi.fn().mockResolvedValue(undefined);
      const { result } = renderHook(() =>
        useSettingsForm(mockUser, null, onProfileChange, undefined)
      );

      act(() => {
        result.current.setNewUsername("newuser");
        result.current.setUsernamePassword("Password1");
      });

      await act(async () => {
        await result.current.handleUsernameSubmit();
      });

      expect(mockUpdateProfile).toHaveBeenCalledWith({
        username: "newuser",
        currentPassword: "Password1",
      });
      expect(toast.success).toHaveBeenCalledWith("Username saved");
      expect(onProfileChange).toHaveBeenCalled();
    });

    it("returns to main step after success", async () => {
      const { result } = renderHook(() =>
        useSettingsForm(mockUser, null, undefined, undefined)
      );

      act(() => {
        result.current.setCurrentStep("username");
        result.current.setNewUsername("newuser");
        result.current.setUsernamePassword("Password1");
      });

      await act(async () => {
        await result.current.handleUsernameSubmit();
      });

      expect(result.current.currentStep).toBe("main");
    });

    it("shows error on server action failure", async () => {
      mockUpdateProfile.mockResolvedValueOnce({
        success: false,
        error: "Username contains reserved word",
      });

      const { result } = renderHook(() =>
        useSettingsForm(mockUser, null, undefined, undefined)
      );

      act(() => {
        result.current.setNewUsername("admin");
        result.current.setUsernamePassword("Password1");
      });

      await act(async () => {
        await result.current.handleUsernameSubmit();
      });

      expect(toast.error).toHaveBeenCalledWith(
        "Username contains reserved word"
      );
    });

    it("handles exception with catch toast", async () => {
      mockUpdateProfile.mockRejectedValueOnce(new Error("Network error"));

      const { result } = renderHook(() =>
        useSettingsForm(mockUser, null, undefined, undefined)
      );

      act(() => {
        result.current.setNewUsername("newuser");
        result.current.setUsernamePassword("Password1");
      });

      await act(async () => {
        await result.current.handleUsernameSubmit();
      });

      expect(toast.error).toHaveBeenCalledWith("Failed to change username");
    });

    it("resets isUsernameSaving after success", async () => {
      const { result } = renderHook(() =>
        useSettingsForm(mockUser, null, undefined, undefined)
      );

      act(() => {
        result.current.setNewUsername("newuser");
        result.current.setUsernamePassword("Password1");
      });

      await act(async () => {
        await result.current.handleUsernameSubmit();
      });

      expect(result.current.isUsernameSaving).toBe(false);
    });

    it("resets isUsernameSaving after failure", async () => {
      mockUpdateProfile.mockRejectedValueOnce(new Error("fail"));

      const { result } = renderHook(() =>
        useSettingsForm(mockUser, null, undefined, undefined)
      );

      act(() => {
        result.current.setNewUsername("newuser");
        result.current.setUsernamePassword("Password1");
      });

      await act(async () => {
        await result.current.handleUsernameSubmit();
      });

      expect(result.current.isUsernameSaving).toBe(false);
    });
  });

  // -------------------------------------------------------------------------
  // Image handlers — deeper testing
  // -------------------------------------------------------------------------

  describe("image handlers — deeper testing", () => {
    it("handleProfileImageDrop creates preview URL", () => {
      const { result } = renderHook(() =>
        useSettingsForm(mockUser, null, undefined, undefined)
      );

      act(() => {
        const file = new File(["data"], "avatar.jpg", {
          type: "image/jpeg",
        });
        result.current.handleProfileImageDrop([file]);
      });

      expect(URL.createObjectURL).toHaveBeenCalled();
      expect(result.current.profileImagePreview).toBe("blob:test");
      expect(result.current.profileImage).toBeInstanceOf(File);
    });

    it("handleHeroImageDrop creates preview URL", () => {
      const { result } = renderHook(() =>
        useSettingsForm(mockUser, null, undefined, undefined)
      );

      act(() => {
        const file = new File(["data"], "hero.jpg", { type: "image/jpeg" });
        result.current.handleHeroImageDrop([file]);
      });

      expect(URL.createObjectURL).toHaveBeenCalled();
      expect(result.current.heroImagePreview).toBe("blob:test");
      expect(result.current.heroImage).toBeInstanceOf(File);
    });

    it("handleRemoveHeroImage marks hero for removal", () => {
      const { result } = renderHook(() =>
        useSettingsForm(mockUser, null, undefined, undefined)
      );

      act(() => {
        result.current.handleRemoveHeroImage();
      });

      expect(result.current.removeHero).toBe(true);
      expect(result.current.heroImage).toBeNull();
      expect(result.current.heroImagePreview).toBeNull();
    });

    it("handleProfileImageDrop clears removeProfile flag", () => {
      const { result } = renderHook(() =>
        useSettingsForm(mockUser, null, undefined, undefined)
      );

      // First mark for removal
      act(() => {
        result.current.handleRemoveProfileImage();
      });
      expect(result.current.removeProfile).toBe(true);

      // Then drop a new image — should clear the removal flag
      act(() => {
        const file = new File(["data"], "new.jpg", { type: "image/jpeg" });
        result.current.handleProfileImageDrop([file]);
      });
      expect(result.current.removeProfile).toBe(false);
      expect(result.current.profileImage).toBeInstanceOf(File);
    });

    it("handleHeroImageDrop clears removeHero flag", () => {
      const { result } = renderHook(() =>
        useSettingsForm(mockUser, null, undefined, undefined)
      );

      // First mark for removal
      act(() => {
        result.current.handleRemoveHeroImage();
      });
      expect(result.current.removeHero).toBe(true);

      // Then drop a new image — should clear the removal flag
      act(() => {
        const file = new File(["data"], "new.jpg", { type: "image/jpeg" });
        result.current.handleHeroImageDrop([file]);
      });
      expect(result.current.removeHero).toBe(false);
      expect(result.current.heroImage).toBeInstanceOf(File);
    });

    it("does nothing when empty files array is passed to handleProfileImageDrop", () => {
      const { result } = renderHook(() =>
        useSettingsForm(mockUser, null, undefined, undefined)
      );

      act(() => {
        result.current.handleProfileImageDrop([]);
      });

      expect(result.current.profileImage).toBeNull();
      expect(result.current.profileImagePreview).toBeNull();
    });

    it("does nothing when empty files array is passed to handleHeroImageDrop", () => {
      const { result } = renderHook(() =>
        useSettingsForm(mockUser, null, undefined, undefined)
      );

      act(() => {
        result.current.handleHeroImageDrop([]);
      });

      expect(result.current.heroImage).toBeNull();
      expect(result.current.heroImagePreview).toBeNull();
    });
  });

  // -------------------------------------------------------------------------
  // Computed image sources
  // -------------------------------------------------------------------------

  describe("computed image sources", () => {
    it("profileImageSrc shows preview URL when available", () => {
      const { result } = renderHook(() =>
        useSettingsForm(mockUser, null, undefined, undefined)
      );

      act(() => {
        const file = new File(["data"], "avatar.jpg", {
          type: "image/jpeg",
        });
        result.current.handleProfileImageDrop([file]);
      });

      expect(result.current.profileImageSrc).toBe("blob:test");
    });

    it("profileImageSrc shows /api/user/avatar when user has image and no removal", () => {
      const userWithImage: SettingsFormUser = {
        ...mockUser,
        hasImage: true,
      };
      const { result } = renderHook(() =>
        useSettingsForm(userWithImage, null, undefined, undefined)
      );

      expect(result.current.profileImageSrc).toBe("/api/user/avatar");
    });

    it("profileImageSrc returns null when image removed", () => {
      const userWithImage: SettingsFormUser = {
        ...mockUser,
        hasImage: true,
      };
      const { result } = renderHook(() =>
        useSettingsForm(userWithImage, null, undefined, undefined)
      );

      act(() => {
        result.current.handleRemoveProfileImage();
      });

      expect(result.current.profileImageSrc).toBeNull();
    });

    it("profileImageSrc returns null when user has no image", () => {
      const { result } = renderHook(() =>
        useSettingsForm(mockUser, null, undefined, undefined)
      );

      expect(result.current.profileImageSrc).toBeNull();
    });

    it("heroImageSrc shows preview URL when available", () => {
      const { result } = renderHook(() =>
        useSettingsForm(mockUser, null, undefined, undefined)
      );

      act(() => {
        const file = new File(["data"], "hero.jpg", { type: "image/jpeg" });
        result.current.handleHeroImageDrop([file]);
      });

      expect(result.current.heroImageSrc).toBe("blob:test");
    });

    it("heroImageSrc shows /api/user/hero when user has hero image and no removal", () => {
      const userWithHero: SettingsFormUser = {
        ...mockUser,
        hasHeroImage: true,
      };
      const { result } = renderHook(() =>
        useSettingsForm(userWithHero, null, undefined, undefined)
      );

      expect(result.current.heroImageSrc).toBe("/api/user/hero");
    });

    it("heroImageSrc returns null when hero removed", () => {
      const userWithHero: SettingsFormUser = {
        ...mockUser,
        hasHeroImage: true,
      };
      const { result } = renderHook(() =>
        useSettingsForm(userWithHero, null, undefined, undefined)
      );

      act(() => {
        result.current.handleRemoveHeroImage();
      });

      expect(result.current.heroImageSrc).toBeNull();
    });

    it("heroImageSrc returns null when user has no hero image", () => {
      const { result } = renderHook(() =>
        useSettingsForm(mockUser, null, undefined, undefined)
      );

      expect(result.current.heroImageSrc).toBeNull();
    });
  });

  // -------------------------------------------------------------------------
  // Bio dirty tracking
  // -------------------------------------------------------------------------

  describe("bio dirty tracking", () => {
    it("is dirty when bio changes", () => {
      const { result } = renderHook(() =>
        useSettingsForm(mockUser, null, undefined, undefined)
      );

      act(() => {
        result.current.setBio("A new bio");
      });

      expect(result.current.isDirty).toBe(true);
    });

    it("is not dirty when bio set back to original", () => {
      const { result } = renderHook(() =>
        useSettingsForm(mockUser, null, undefined, undefined)
      );

      act(() => {
        result.current.setBio("A new bio");
      });
      expect(result.current.isDirty).toBe(true);

      act(() => {
        result.current.setBio(""); // original bio is null -> ""
      });
      expect(result.current.isDirty).toBe(false);
    });

    it("is dirty when bio changes for user with existing bio", () => {
      const userWithBio: SettingsFormUser = {
        ...mockUser,
        bio: "Existing bio",
      };
      const { result } = renderHook(() =>
        useSettingsForm(userWithBio, null, undefined, undefined)
      );

      expect(result.current.isDirty).toBe(false);

      act(() => {
        result.current.setBio("Updated bio");
      });

      expect(result.current.isDirty).toBe(true);
    });
  });

  // -------------------------------------------------------------------------
  // removeHero dirty tracking
  // -------------------------------------------------------------------------

  describe("removeHero dirty tracking", () => {
    it("is dirty when hero removal is flagged", () => {
      const { result } = renderHook(() =>
        useSettingsForm(mockUser, null, undefined, undefined)
      );

      act(() => {
        result.current.handleRemoveHeroImage();
      });

      expect(result.current.isDirty).toBe(true);
    });
  });
});
