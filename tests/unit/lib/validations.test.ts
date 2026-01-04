/**
 * Unit tests for validation schemas.
 * Tests email, password, and form validation rules.
 */

import { describe, it, expect } from "vitest";
import {
  emailSchema,
  passwordSchema,
  signUpSchema,
  sftpConnectionSchema,
  sftpFileNameSchema,
  itemDescriptionSchema,
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

describe("sftpConnectionSchema", () => {
  it("validates correct connection", () => {
    const result = sftpConnectionSchema.safeParse({
      name: "My Server",
      host: "sftp.example.com",
      port: 22,
      username: "user",
      authType: "PASSWORD",
      credential: "password123",
      basePath: "/uploads",
    });
    expect(result.success).toBe(true);
  });

  it("requires name", () => {
    const result = sftpConnectionSchema.safeParse({
      host: "sftp.example.com",
      username: "user",
      authType: "PASSWORD",
      credential: "pass",
    });
    expect(result.success).toBe(false);
  });

  it("validates port range", () => {
    const result = sftpConnectionSchema.safeParse({
      name: "Test",
      host: "host",
      port: 70000,
      username: "user",
      authType: "PASSWORD",
      credential: "pass",
    });
    expect(result.success).toBe(false);
  });

  it("defaults port to 22", () => {
    const result = sftpConnectionSchema.safeParse({
      name: "Test",
      host: "host",
      username: "user",
      authType: "PASSWORD",
      credential: "pass",
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.port).toBe(22);
    }
  });
});

describe("sftpFileNameSchema", () => {
  it("accepts valid filenames", () => {
    expect(sftpFileNameSchema.safeParse("document.pdf").success).toBe(true);
    expect(sftpFileNameSchema.safeParse("my-file_2024.txt").success).toBe(true);
  });

  it("rejects invalid characters", () => {
    expect(sftpFileNameSchema.safeParse("file<>.txt").success).toBe(false);
    expect(sftpFileNameSchema.safeParse("file:name").success).toBe(false);
  });

  it("rejects empty string", () => {
    expect(sftpFileNameSchema.safeParse("").success).toBe(false);
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

  it("accepts max length description (200 chars)", () => {
    const result = itemDescriptionSchema.safeParse("a".repeat(200));
    expect(result.success).toBe(true);
  });

  it("rejects description over 200 characters", () => {
    const result = itemDescriptionSchema.safeParse("a".repeat(201));
    expect(result.success).toBe(false);
    expect(result.error?.issues[0].message).toContain("200");
  });

  it("trims whitespace", () => {
    const result = itemDescriptionSchema.safeParse("  trimmed  ");
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data).toBe("trimmed");
    }
  });

  it("trims then validates length (whitespace-padded 201 chars trims to valid)", () => {
    // 198 chars + 3 spaces = 201 total, but trims to 198
    const result = itemDescriptionSchema.safeParse("a".repeat(198) + "   ");
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data).toBe("a".repeat(198));
    }
  });

  it("rejects when trimmed result still exceeds 200 chars", () => {
    // 201 chars with surrounding whitespace
    const result = itemDescriptionSchema.safeParse(
      "  " + "a".repeat(201) + "  "
    );
    expect(result.success).toBe(false);
  });
});
