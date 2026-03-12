import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { randomBytes } from "crypto";
import { createTRPCRouter, publicProcedure } from "../trpc";
import { rateLimit } from "../middleware/rate-limit";
import {
  signUpSchema,
  forgotPasswordSchema,
  resetPasswordSchema,
  verifyEmailSchema,
  usernameSchema,
} from "@canoncore/validators";

/** Standardised bcrypt cost factor for all password hashing. */
const BCRYPT_ROUNDS = 12;

/**
 * Email sending function type.
 * Injected via environment — the caller provides these implementations
 * since email sending depends on Resend configuration (web-specific env).
 */
async function sendPasswordResetEmail(
  email: string,
  token: string
): Promise<void> {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
  const apiKey = process.env.RESEND_API_KEY;
  const emailFrom = process.env.EMAIL_FROM || "noreply@canoncore.com";

  if (!apiKey) {
    throw new Error("RESEND_API_KEY not configured");
  }

  const resetUrl = `${appUrl}/reset-password?token=${token}`;

  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: emailFrom,
      to: email,
      subject: "Reset your password",
      html: `
        <h1>Reset your password</h1>
        <p>Click the link below to reset your password. This link expires in 30 minutes.</p>
        <a href="${resetUrl}">Reset Password</a>
        <p>If you didn't request this, you can safely ignore this email.</p>
      `,
    }),
  });

  if (!response.ok) {
    throw new Error("Failed to send email");
  }
}

async function sendVerificationEmail(
  email: string,
  token: string
): Promise<void> {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
  const apiKey = process.env.RESEND_API_KEY;
  const emailFrom = process.env.EMAIL_FROM || "noreply@canoncore.com";

  if (!apiKey) {
    throw new Error("RESEND_API_KEY not configured");
  }

  const verifyUrl = `${appUrl}/verify-email?token=${token}`;

  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: emailFrom,
      to: email,
      subject: "Verify your email address",
      html: `
        <h1>Verify your email</h1>
        <p>Click the link below to verify your email address. This link expires in 30 minutes.</p>
        <a href="${verifyUrl}">Verify Email</a>
        <p>If you didn't create an account, you can safely ignore this email.</p>
      `,
    }),
  });

  if (!response.ok) {
    throw new Error("Failed to send verification email");
  }
}

export const authRouter = createTRPCRouter({
  /**
   * Creates a new user account with hashed password.
   * Sends verification email after creation (non-blocking on failure).
   */
  signUp: publicProcedure
    .use(rateLimit("signUp"))
    .input(
      signUpSchema.extend({
        username: usernameSchema.optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const { hash } = await import("bcryptjs");

      // Run uniqueness checks in parallel
      const [existingUser, existingUsername] = await Promise.all([
        ctx.prisma.user.findUnique({ where: { email: input.email } }),
        input.username
          ? ctx.prisma.user.findFirst({
              where: {
                username: { equals: input.username, mode: "insensitive" },
              },
            })
          : Promise.resolve(null),
      ]);

      if (existingUser) {
        throw new TRPCError({
          code: "CONFLICT",
          message: "An account with this email already exists",
        });
      }

      if (existingUsername) {
        throw new TRPCError({
          code: "CONFLICT",
          message: "This username is already taken",
        });
      }

      const passwordHash = await hash(input.password, BCRYPT_ROUNDS);

      const user = await ctx.prisma.user.create({
        data: {
          email: input.email,
          passwordHash,
          username: input.username ?? null,
        },
      });

      // Send verification email (non-blocking — user can resend later)
      try {
        const verificationToken = randomBytes(32).toString("hex");
        const verificationExpires = new Date(Date.now() + 30 * 60 * 1000);

        await ctx.prisma.emailVerificationToken.create({
          data: {
            token: verificationToken,
            userId: user.id,
            email: input.email,
            expires: verificationExpires,
          },
        });

        await sendVerificationEmail(input.email, verificationToken);
      } catch {
        // Non-blocking — user can resend later
      }

      return { success: true };
    }),

  /**
   * Checks sign-in status for a given email (lockout differentiation).
   * Anti-enumeration: returns { status: "ok" } for unknown emails.
   * No rate limiting — lightweight read-only check.
   */
  checkLockout: publicProcedure
    .input(z.object({ email: z.string().email() }))
    .query(async ({ ctx, input }) => {
      const user = await ctx.prisma.user.findUnique({
        where: { email: input.email },
        select: { lockedUntil: true, failedLoginAttempts: true },
      });

      if (!user) {
        return { status: "ok" as const };
      }

      if (user.lockedUntil && user.lockedUntil > new Date()) {
        const remainingMs = user.lockedUntil.getTime() - Date.now();
        const remainingMinutes = Math.ceil(remainingMs / (60 * 1000));
        return { status: "locked" as const, remainingMinutes };
      }

      return { status: "ok" as const };
    }),

  /**
   * Verifies an email address using a verification token.
   * Handles both signup verification and email change verification.
   */
  verifyEmail: publicProcedure
    .use(rateLimit("emailVerification"))
    .input(verifyEmailSchema)
    .mutation(async ({ ctx, input }) => {
      const verificationToken =
        await ctx.prisma.emailVerificationToken.findUnique({
          where: { token: input.token },
          include: { user: true },
        });

      if (!verificationToken) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Invalid or expired verification link",
        });
      }

      if (verificationToken.expires < new Date()) {
        await ctx.prisma.emailVerificationToken.delete({
          where: { id: verificationToken.id },
        });
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Verification link has expired",
        });
      }

      // Determine if this is a signup verification or email change
      const isEmailChange =
        verificationToken.email !== verificationToken.user.email;

      if (isEmailChange) {
        // Check new email is still available
        const existing = await ctx.prisma.user.findUnique({
          where: { email: verificationToken.email },
        });
        if (existing) {
          await ctx.prisma.emailVerificationToken.delete({
            where: { id: verificationToken.id },
          });
          throw new TRPCError({
            code: "CONFLICT",
            message: "Email address is already in use",
          });
        }
      }

      await Promise.all([
        ctx.prisma.user.update({
          where: { id: verificationToken.userId },
          data: {
            emailVerified: new Date(),
            ...(isEmailChange && { email: verificationToken.email }),
          },
        }),
        ctx.prisma.emailVerificationToken.delete({
          where: { id: verificationToken.id },
        }),
      ]);

      return { success: true };
    }),

  /**
   * Initiates password reset flow by sending a reset email.
   * Always returns success to prevent email enumeration attacks.
   */
  forgotPassword: publicProcedure
    .use(rateLimit("forgotPassword"))
    .input(forgotPasswordSchema)
    .mutation(async ({ ctx, input }) => {
      const user = await ctx.prisma.user.findUnique({
        where: { email: input.email },
      });

      // Always return success to prevent email enumeration
      if (!user) {
        return { success: true };
      }

      // Delete any existing password reset tokens for this user
      await ctx.prisma.passwordReset.deleteMany({
        where: { userId: user.id },
      });

      // Create new reset token (expires in 30 minutes)
      const token = randomBytes(32).toString("hex");
      const expires = new Date(Date.now() + 30 * 60 * 1000);

      await ctx.prisma.passwordReset.create({
        data: {
          token,
          userId: user.id,
          expires,
        },
      });

      try {
        await sendPasswordResetEmail(input.email, token);
      } catch {
        // Clean up orphaned token if email fails
        await ctx.prisma.passwordReset.delete({ where: { token } });
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to send reset email",
        });
      }

      return { success: true };
    }),

  /**
   * Resets user password using a valid reset token.
   * Validates token, updates password, and cleans up used token.
   */
  resetPassword: publicProcedure
    .use(rateLimit("forgotPassword"))
    .input(resetPasswordSchema)
    .mutation(async ({ ctx, input }) => {
      const { hash } = await import("bcryptjs");

      const passwordReset = await ctx.prisma.passwordReset.findUnique({
        where: { token: input.token },
        include: { user: true },
      });

      if (!passwordReset) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Invalid or expired reset link",
        });
      }

      if (passwordReset.expires < new Date()) {
        // Clean up expired token
        await ctx.prisma.passwordReset.delete({
          where: { id: passwordReset.id },
        });
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Reset link has expired",
        });
      }

      const passwordHash = await hash(input.password, BCRYPT_ROUNDS);

      // Parallelize independent DB operations: update password + delete token
      await Promise.all([
        ctx.prisma.user.update({
          where: { id: passwordReset.userId },
          data: { passwordHash, tokenVersion: { increment: 1 } },
        }),
        ctx.prisma.passwordReset.delete({
          where: { id: passwordReset.id },
        }),
      ]);

      return { success: true };
    }),
});
