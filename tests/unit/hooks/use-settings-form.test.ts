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

vi.mock("@/hooks/use-username-validation", () => ({
  useUsernameValidation: () => ({
    isValidFormat: true,
    isAvailable: true,
    isChecking: false,
    error: null,
  }),
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
});
