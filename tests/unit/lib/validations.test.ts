/**
 * Unit tests for validation schemas.
 * Tests email, password, and form validation rules.
 */

import { describe, it, expect } from "vitest";
import {
  emailSchema,
  passwordSchema,
  signUpSchema,
  itemNameSchema,
  itemDescriptionSchema,
  playlistNameSchema,
  playlistDescriptionSchema,
  usernameSchema,
  validateUsername,
  isUsernameReserved,
  RESERVED_USERNAMES,
  resetPasswordSchema,
  forgotPasswordSchema,
  playlistArtworkSchema,
} from "@/lib/validations";

describe("emailSchema", () => {
  it("accepts valid email", () => {
    expect(emailSchema.safeParse("user@example.com").success).toBe(true);
  });

  it("rejects invalid email format", () => {
    const result = emailSchema.safeParse("notanemail");
    expect(result.success).toBe(false);
  });

  it("rejects empty email", () => {
    const result = emailSchema.safeParse("");
    expect(result.success).toBe(false);
  });
});

describe("passwordSchema", () => {
  it("accepts valid password with uppercase, lowercase, number", () => {
    expect(passwordSchema.safeParse("Password1").success).toBe(true);
  });

  it("accepts complex password", () => {
    expect(passwordSchema.safeParse("MySecure123Pass").success).toBe(true);
  });

  it("rejects password under 8 characters", () => {
    const result = passwordSchema.safeParse("Pass1");
    expect(result.success).toBe(false);
  });

  it("rejects password without uppercase", () => {
    const result = passwordSchema.safeParse("password1");
    expect(result.success).toBe(false);
  });

  it("rejects password without lowercase", () => {
    const result = passwordSchema.safeParse("PASSWORD1");
    expect(result.success).toBe(false);
  });

  it("rejects password without number", () => {
    const result = passwordSchema.safeParse("Password");
    expect(result.success).toBe(false);
  });
});

describe("signUpSchema", () => {
  it("accepts valid email and password", () => {
    const result = signUpSchema.safeParse({
      email: "user@example.com",
      password: "Password123",
    });
    expect(result.success).toBe(true);
  });

  it("rejects invalid email with valid password", () => {
    const result = signUpSchema.safeParse({
      email: "invalid",
      password: "Password123",
    });
    expect(result.success).toBe(false);
  });

  it("rejects valid email with weak password", () => {
    const result = signUpSchema.safeParse({
      email: "user@example.com",
      password: "weak",
    });
    expect(result.success).toBe(false);
  });
});

describe("itemNameSchema", () => {
  it("accepts simple name", () => {
    expect(itemNameSchema.safeParse("Torchwood").success).toBe(true);
  });

  it("accepts name with year in parentheses (TMDB format)", () => {
    expect(itemNameSchema.safeParse("Torchwood (2006)").success).toBe(true);
  });

  it("accepts name with hyphens and underscores", () => {
    expect(itemNameSchema.safeParse("Spider-Man_Homecoming").success).toBe(
      true
    );
  });

  it("rejects empty name", () => {
    const result = itemNameSchema.safeParse("");
    expect(result.success).toBe(false);
  });

  it("rejects name with special characters", () => {
    const result = itemNameSchema.safeParse("Movie: The Sequel!");
    expect(result.success).toBe(false);
  });

  it("rejects name exceeding 255 characters", () => {
    const result = itemNameSchema.safeParse("a".repeat(256));
    expect(result.success).toBe(false);
  });
});

describe("itemDescriptionSchema", () => {
  it("accepts empty string", () => {
    const result = itemDescriptionSchema.safeParse("");
    expect(result.success).toBe(true);
  });

  it("accepts valid description", () => {
    const result = itemDescriptionSchema.safeParse("A short description");
    expect(result.success).toBe(true);
  });

  it("accepts description with special characters", () => {
    const result = itemDescriptionSchema.safeParse(
      "Movie (2024) - Director's Cut!"
    );
    expect(result.success).toBe(true);
  });

  it("accepts max length description (1000 chars)", () => {
    const result = itemDescriptionSchema.safeParse("a".repeat(1000));
    expect(result.success).toBe(true);
  });

  it("rejects description over 1000 characters", () => {
    const result = itemDescriptionSchema.safeParse("a".repeat(1001));
    expect(result.success).toBe(false);
    expect(result.error?.issues[0].message).toContain("1000");
  });

  it("trims whitespace", () => {
    const result = itemDescriptionSchema.safeParse("  trimmed  ");
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data).toBe("trimmed");
    }
  });

  it("trims then validates length (whitespace-padded 1001 chars trims to valid)", () => {
    // 998 chars + 3 spaces = 1001 total, but trims to 998
    const result = itemDescriptionSchema.safeParse("a".repeat(998) + "   ");
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data).toBe("a".repeat(998));
    }
  });

  it("rejects when trimmed result still exceeds 1000 chars", () => {
    // 1001 chars with surrounding whitespace
    const result = itemDescriptionSchema.safeParse(
      "  " + "a".repeat(1001) + "  "
    );
    expect(result.success).toBe(false);
  });
});

describe("playlistNameSchema", () => {
  it("accepts valid playlist names", () => {
    expect(playlistNameSchema.safeParse("Weekend Watchlist").success).toBe(
      true
    );
    expect(playlistNameSchema.safeParse("My Top 10").success).toBe(true);
    expect(playlistNameSchema.safeParse("a").success).toBe(true);
  });

  it("accepts names with special characters", () => {
    expect(playlistNameSchema.safeParse("Best of 2025!").success).toBe(true);
    expect(playlistNameSchema.safeParse("Sci-Fi: The Classics").success).toBe(
      true
    );
  });

  it("rejects empty name", () => {
    expect(playlistNameSchema.safeParse("").success).toBe(false);
  });

  it("rejects whitespace-only name", () => {
    expect(playlistNameSchema.safeParse("   ").success).toBe(false);
  });

  it("rejects name over 255 chars", () => {
    expect(playlistNameSchema.safeParse("a".repeat(256)).success).toBe(false);
  });

  it("trims whitespace", () => {
    const result = playlistNameSchema.safeParse("  My Playlist  ");
    expect(result.success).toBe(true);
    if (result.success) expect(result.data).toBe("My Playlist");
  });
});

describe("playlistDescriptionSchema", () => {
  it("accepts valid descriptions", () => {
    expect(
      playlistDescriptionSchema.safeParse("A great playlist").success
    ).toBe(true);
  });

  it("accepts empty string", () => {
    expect(playlistDescriptionSchema.safeParse("").success).toBe(true);
  });

  it("rejects description over 1000 chars", () => {
    expect(playlistDescriptionSchema.safeParse("a".repeat(1001)).success).toBe(
      false
    );
  });

  it("trims whitespace before validating", () => {
    const result = playlistDescriptionSchema.safeParse("  trimmed  ");
    expect(result.success).toBe(true);
    if (result.success) expect(result.data).toBe("trimmed");
  });
});

describe("usernameSchema", () => {
  describe("length validation", () => {
    it("accepts username with minimum length (3 chars)", () => {
      expect(usernameSchema.safeParse("abc").success).toBe(true);
    });

    it("accepts username with maximum length (20 chars)", () => {
      expect(usernameSchema.safeParse("a".repeat(20)).success).toBe(true);
    });

    it("rejects username under 3 characters", () => {
      const result = usernameSchema.safeParse("ab");
      expect(result.success).toBe(false);
      expect(result.error?.issues[0].message).toContain("at least 3");
    });

    it("rejects username over 20 characters", () => {
      const result = usernameSchema.safeParse("a".repeat(21));
      expect(result.success).toBe(false);
      expect(result.error?.issues[0].message).toContain("20 characters");
    });

    it("rejects empty username", () => {
      const result = usernameSchema.safeParse("");
      expect(result.success).toBe(false);
    });
  });

  describe("character validation", () => {
    it("accepts lowercase letters", () => {
      expect(usernameSchema.safeParse("testuser").success).toBe(true);
    });

    it("accepts numbers", () => {
      expect(usernameSchema.safeParse("user123").success).toBe(true);
    });

    it("accepts underscores in middle", () => {
      expect(usernameSchema.safeParse("test_user").success).toBe(true);
    });

    it("accepts mixed lowercase letters, numbers, and underscores", () => {
      expect(usernameSchema.safeParse("user_123_test").success).toBe(true);
    });

    it("rejects uppercase letters", () => {
      const result = usernameSchema.safeParse("TestUser");
      expect(result.success).toBe(false);
      expect(result.error?.issues[0].message).toContain("lowercase");
    });

    it("rejects spaces", () => {
      const result = usernameSchema.safeParse("test user");
      expect(result.success).toBe(false);
    });

    it("rejects hyphens", () => {
      const result = usernameSchema.safeParse("test-user");
      expect(result.success).toBe(false);
    });

    it("rejects special characters", () => {
      const result = usernameSchema.safeParse("test@user");
      expect(result.success).toBe(false);
    });

    it("rejects periods", () => {
      const result = usernameSchema.safeParse("test.user");
      expect(result.success).toBe(false);
    });
  });

  describe("underscore position validation", () => {
    it("rejects username starting with underscore", () => {
      const result = usernameSchema.safeParse("_testuser");
      expect(result.success).toBe(false);
      expect(result.error?.issues[0].message).toContain(
        "cannot start with an underscore"
      );
    });

    it("rejects username ending with underscore", () => {
      const result = usernameSchema.safeParse("testuser_");
      expect(result.success).toBe(false);
      expect(result.error?.issues[0].message).toContain(
        "cannot end with an underscore"
      );
    });

    it("rejects consecutive underscores", () => {
      const result = usernameSchema.safeParse("test__user");
      expect(result.success).toBe(false);
      expect(result.error?.issues[0].message).toContain("consecutive");
    });

    it("accepts single underscores between characters", () => {
      expect(usernameSchema.safeParse("a_b_c_d").success).toBe(true);
    });
  });

  describe("reserved username validation", () => {
    it("rejects 'admin' as reserved", () => {
      const result = usernameSchema.safeParse("admin");
      expect(result.success).toBe(false);
      expect(result.error?.issues[0].message).toContain("reserved");
    });

    it("rejects 'api' as reserved", () => {
      const result = usernameSchema.safeParse("api");
      expect(result.success).toBe(false);
    });

    it("rejects 'canoncore' as reserved", () => {
      const result = usernameSchema.safeParse("canoncore");
      expect(result.success).toBe(false);
    });

    it("rejects 'settings' as reserved", () => {
      const result = usernameSchema.safeParse("settings");
      expect(result.success).toBe(false);
    });

    it("rejects 'explore' as reserved", () => {
      const result = usernameSchema.safeParse("explore");
      expect(result.success).toBe(false);
    });

    it("rejects 'test' as reserved", () => {
      const result = usernameSchema.safeParse("test");
      expect(result.success).toBe(false);
    });

    it("accepts non-reserved username", () => {
      expect(usernameSchema.safeParse("johndoe").success).toBe(true);
    });
  });
});

describe("validateUsername", () => {
  it("returns success for valid username", () => {
    const result = validateUsername("johndoe");
    expect(result.success).toBe(true);
    expect(result.error).toBeUndefined();
  });

  it("returns error for username too short", () => {
    const result = validateUsername("ab");
    expect(result.success).toBe(false);
    expect(result.error).toContain("at least 3");
  });

  it("returns error for username too long", () => {
    const result = validateUsername("a".repeat(21));
    expect(result.success).toBe(false);
    expect(result.error).toContain("20 characters");
  });

  it("returns error for uppercase letters", () => {
    const result = validateUsername("TestUser");
    expect(result.success).toBe(false);
    expect(result.error).toContain("lowercase");
  });

  it("returns error for leading underscore", () => {
    const result = validateUsername("_user");
    expect(result.success).toBe(false);
    expect(result.error).toContain("cannot start");
  });

  it("returns error for trailing underscore", () => {
    const result = validateUsername("user_");
    expect(result.success).toBe(false);
    expect(result.error).toContain("cannot end");
  });

  it("returns error for consecutive underscores", () => {
    const result = validateUsername("test__user");
    expect(result.success).toBe(false);
    expect(result.error).toContain("consecutive");
  });

  it("returns error for reserved username", () => {
    const result = validateUsername("admin");
    expect(result.success).toBe(false);
    expect(result.error).toContain("reserved");
  });

  it("returns first error when multiple validation failures", () => {
    // "AB" fails length (< 3) and uppercase
    const result = validateUsername("AB");
    expect(result.success).toBe(false);
    expect(result.error).toBeDefined();
  });
});

describe("isUsernameReserved", () => {
  it("returns true for reserved system route", () => {
    expect(isUsernameReserved("admin")).toBe(true);
    expect(isUsernameReserved("api")).toBe(true);
    expect(isUsernameReserved("settings")).toBe(true);
  });

  it("returns true for reserved admin terms", () => {
    expect(isUsernameReserved("moderator")).toBe(true);
    expect(isUsernameReserved("staff")).toBe(true);
  });

  it("returns true for reserved brand terms", () => {
    expect(isUsernameReserved("canoncore")).toBe(true);
    expect(isUsernameReserved("canon")).toBe(true);
  });

  it("performs case-insensitive check", () => {
    expect(isUsernameReserved("ADMIN")).toBe(true);
    expect(isUsernameReserved("Admin")).toBe(true);
    expect(isUsernameReserved("aDmIn")).toBe(true);
  });

  it("returns false for non-reserved username", () => {
    expect(isUsernameReserved("johndoe")).toBe(false);
    expect(isUsernameReserved("myusername")).toBe(false);
  });
});

describe("RESERVED_USERNAMES", () => {
  it("is a Set containing expected system routes", () => {
    expect(RESERVED_USERNAMES.has("admin")).toBe(true);
    expect(RESERVED_USERNAMES.has("api")).toBe(true);
    expect(RESERVED_USERNAMES.has("auth")).toBe(true);
    expect(RESERVED_USERNAMES.has("explore")).toBe(true);
  });

  it("contains brand protection terms", () => {
    expect(RESERVED_USERNAMES.has("canoncore")).toBe(true);
  });

  it("is case-sensitive (stores lowercase)", () => {
    expect(RESERVED_USERNAMES.has("admin")).toBe(true);
    expect(RESERVED_USERNAMES.has("ADMIN")).toBe(false);
  });
});

describe("resetPasswordSchema", () => {
  it("accepts valid token and password", () => {
    const result = resetPasswordSchema.safeParse({
      token: "abc123",
      password: "Password1",
    });
    expect(result.success).toBe(true);
  });

  it("rejects empty token", () => {
    const result = resetPasswordSchema.safeParse({
      token: "",
      password: "Password1",
    });
    expect(result.success).toBe(false);
  });

  it("rejects weak password", () => {
    const result = resetPasswordSchema.safeParse({
      token: "abc123",
      password: "weak",
    });
    expect(result.success).toBe(false);
  });
});

describe("forgotPasswordSchema", () => {
  it("accepts valid email", () => {
    const result = forgotPasswordSchema.safeParse({
      email: "user@example.com",
    });
    expect(result.success).toBe(true);
  });

  it("rejects invalid email", () => {
    const result = forgotPasswordSchema.safeParse({
      email: "invalid",
    });
    expect(result.success).toBe(false);
  });

  it("rejects empty email", () => {
    const result = forgotPasswordSchema.safeParse({
      email: "",
    });
    expect(result.success).toBe(false);
  });
});

describe("playlistArtworkSchema", () => {
  it("accepts valid JPEG", () => {
    const result = playlistArtworkSchema.safeParse({
      size: 500_000,
      type: "image/jpeg",
    });
    expect(result.success).toBe(true);
  });

  it("accepts valid PNG", () => {
    const result = playlistArtworkSchema.safeParse({
      size: 1_000_000,
      type: "image/png",
    });
    expect(result.success).toBe(true);
  });

  it("accepts valid WebP", () => {
    const result = playlistArtworkSchema.safeParse({
      size: 100_000,
      type: "image/webp",
    });
    expect(result.success).toBe(true);
  });

  it("rejects file exceeding 2MB", () => {
    const result = playlistArtworkSchema.safeParse({
      size: 3 * 1024 * 1024,
      type: "image/jpeg",
    });
    expect(result.success).toBe(false);
    expect(result.error?.issues[0].message).toContain("2MB");
  });

  it("rejects invalid MIME type", () => {
    const result = playlistArtworkSchema.safeParse({
      size: 100_000,
      type: "image/gif",
    });
    expect(result.success).toBe(false);
    expect(result.error?.issues[0].message).toContain("JPEG");
  });
});
