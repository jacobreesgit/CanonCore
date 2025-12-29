/**
 * Unit tests for validation schemas.
 * Tests email, password, and form validation rules.
 */

import { describe, it, expect } from "vitest";
import { emailSchema, passwordSchema, signUpSchema } from "@/lib/validations";

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
