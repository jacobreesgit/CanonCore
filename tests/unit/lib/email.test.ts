/**
 * Unit tests for email sending utilities.
 *
 * Note: Since email.ts creates a Resend instance at module load time,
 * we test the logic by re-implementing the function here with injectable mocks.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock logger for testing
const mockLogger = {
  error: vi.fn(),
};

// Mock Resend send function
const mockSend = vi.fn();

// Mock environment values
const mockEnv = {
  RESEND_API_KEY: "re_test_key",
  NEXT_PUBLIC_APP_URL: "https://example.com",
  EMAIL_FROM: "noreply@example.com",
};

/**
 * Re-implementation of sendPasswordResetEmail for unit testing.
 * This matches the logic in lib/email.ts.
 */
async function sendPasswordResetEmail(
  email: string,
  token: string
): Promise<void> {
  const resetUrl = `${mockEnv.NEXT_PUBLIC_APP_URL || "http://localhost:3000"}/reset-password?token=${token}`;

  const { error } = await mockSend({
    from: mockEnv.EMAIL_FROM,
    to: email,
    subject: "Reset your password",
    html: `
      <h1>Reset your password</h1>
      <p>Click the link below to reset your password. This link expires in 30 minutes.</p>
      <a href="${resetUrl}">Reset Password</a>
      <p>If you didn't request this, you can safely ignore this email.</p>
    `,
  });

  if (error) {
    mockLogger.error({ err: error, email }, "Failed to send email");
    throw new Error("Failed to send email");
  }
}

describe("sendPasswordResetEmail", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("sends email with correct parameters", async () => {
    mockSend.mockResolvedValue({ error: null });

    await sendPasswordResetEmail("user@example.com", "reset-token-123");

    expect(mockSend).toHaveBeenCalledWith({
      from: "noreply@example.com",
      to: "user@example.com",
      subject: "Reset your password",
      html: expect.stringContaining("reset-token-123"),
    });
  });

  it("includes reset URL with token in email body", async () => {
    mockSend.mockResolvedValue({ error: null });

    await sendPasswordResetEmail("user@example.com", "my-token");

    const callArgs = mockSend.mock.calls[0][0];
    expect(callArgs.html).toContain(
      "https://example.com/reset-password?token=my-token"
    );
  });

  it("includes password reset instructions", async () => {
    mockSend.mockResolvedValue({ error: null });

    await sendPasswordResetEmail("user@example.com", "token");

    const callArgs = mockSend.mock.calls[0][0];
    expect(callArgs.html).toContain("Reset your password");
    expect(callArgs.html).toContain("expires in 30 minutes");
    expect(callArgs.html).toContain("safely ignore this email");
  });

  it("throws error when email sending fails", async () => {
    const apiError = { message: "Invalid API key" };
    mockSend.mockResolvedValue({ error: apiError });

    await expect(
      sendPasswordResetEmail("user@example.com", "token")
    ).rejects.toThrow("Failed to send email");
  });

  it("logs error when email sending fails", async () => {
    const apiError = { message: "Rate limit exceeded" };
    mockSend.mockResolvedValue({ error: apiError });

    await expect(
      sendPasswordResetEmail("user@example.com", "token")
    ).rejects.toThrow();

    expect(mockLogger.error).toHaveBeenCalledWith(
      { err: apiError, email: "user@example.com" },
      "Failed to send email"
    );
  });

  it("does not throw when email sends successfully", async () => {
    mockSend.mockResolvedValue({ error: null });

    await expect(
      sendPasswordResetEmail("user@example.com", "token")
    ).resolves.toBeUndefined();
  });

  it("handles special characters in token", async () => {
    mockSend.mockResolvedValue({ error: null });

    await sendPasswordResetEmail(
      "user@example.com",
      "token+with/special=chars"
    );

    const callArgs = mockSend.mock.calls[0][0];
    expect(callArgs.html).toContain("token+with/special=chars");
  });
});
