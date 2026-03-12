import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { createTRPCRouter, protectedProcedure } from "../trpc";
import { rateLimit } from "../middleware/rate-limit";
import {
  usernameSchema,
  passwordSchema,
  bioSchema,
} from "@canoncore/validators";

/** Standardised bcrypt cost factor for all password hashing. */
const BCRYPT_ROUNDS = 12;

export const userRouter = createTRPCRouter({
  /**
   * Gets the current authenticated user's profile data.
   * No rate limiting — read-only query, auth check sufficient.
   */
  getProfile: protectedProcedure.query(async ({ ctx }) => {
    const user = await ctx.prisma.user.findUnique({
      where: { id: ctx.userId },
      select: {
        id: true,
        name: true,
        email: true,
        username: true,
        image: true,
        heroImage: true,
        bio: true,
        isPublic: true,
      },
    });

    if (!user) {
      throw new TRPCError({ code: "NOT_FOUND", message: "User not found" });
    }

    return {
      id: user.id,
      name: user.name,
      email: user.email,
      username: user.username,
      bio: user.bio,
      isPublic: user.isPublic,
      hasImage: user.image !== null,
      hasHeroImage: user.heroImage !== null,
    };
  }),

  /**
   * Updates profile fields (bio, displayName).
   * Does NOT handle email changes (those require verification flow).
   */
  updateProfile: protectedProcedure
    .use(rateLimit("profileUpdate"))
    .input(
      z.object({
        bio: bioSchema.optional(),
        displayName: z.string().max(100).optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const updateData: Record<string, unknown> = {};

      if (input.bio !== undefined) {
        updateData.bio = input.bio;
      }
      if (input.displayName !== undefined) {
        updateData.name = input.displayName;
      }

      if (Object.keys(updateData).length === 0) {
        return { success: true };
      }

      await ctx.prisma.user.update({
        where: { id: ctx.userId },
        data: updateData,
      });

      return { success: true };
    }),

  /**
   * Updates the user's username.
   * Validates format and checks uniqueness (case-insensitive).
   */
  updateUsername: protectedProcedure
    .use(rateLimit("profileUpdate"))
    .input(z.object({ username: usernameSchema }))
    .mutation(async ({ ctx, input }) => {
      // Check username uniqueness (case-insensitive)
      const existingUsername = await ctx.prisma.user.findFirst({
        where: {
          username: {
            equals: input.username,
            mode: "insensitive",
          },
          id: { not: ctx.userId },
        },
      });

      if (existingUsername) {
        throw new TRPCError({
          code: "CONFLICT",
          message: "Username already taken",
        });
      }

      await ctx.prisma.user.update({
        where: { id: ctx.userId },
        data: { username: input.username },
      });

      return { success: true };
    }),

  /**
   * Changes the user's password.
   * Requires current password for verification.
   * Increments tokenVersion to invalidate existing sessions.
   */
  changePassword: protectedProcedure
    .use(rateLimit("passwordChange"))
    .input(
      z.object({
        currentPassword: z.string().min(1),
        newPassword: passwordSchema,
      })
    )
    .mutation(async ({ ctx, input }) => {
      const { compare, hash } = await import("bcryptjs");

      const user = await ctx.prisma.user.findUnique({
        where: { id: ctx.userId },
        select: { passwordHash: true },
      });

      if (!user) {
        throw new TRPCError({ code: "NOT_FOUND", message: "User not found" });
      }

      // Verify current password
      const passwordValid = await compare(
        input.currentPassword,
        user.passwordHash
      );
      if (!passwordValid) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "Incorrect current password",
        });
      }

      // Hash new password
      const newPasswordHash = await hash(input.newPassword, BCRYPT_ROUNDS);

      await ctx.prisma.user.update({
        where: { id: ctx.userId },
        data: {
          passwordHash: newPasswordHash,
          tokenVersion: { increment: 1 },
        },
      });

      return { success: true };
    }),

  /**
   * Permanently deletes the authenticated user's account and all associated data.
   * Requires password verification and typing "DELETE" to confirm.
   * Prisma cascades handle all related records.
   */
  deleteAccount: protectedProcedure
    .use(rateLimit("accountDeletion"))
    .input(
      z.object({
        password: z.string().min(1, "Password is required"),
        confirmText: z.string().refine((val) => val === "DELETE", {
          message: 'You must type "DELETE" to confirm',
        }),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const { compare } = await import("bcryptjs");

      const user = await ctx.prisma.user.findUnique({
        where: { id: ctx.userId },
        select: { passwordHash: true },
      });

      if (!user) {
        throw new TRPCError({ code: "NOT_FOUND", message: "User not found" });
      }

      // Verify password
      const passwordValid = await compare(input.password, user.passwordHash);
      if (!passwordValid) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "Incorrect password",
        });
      }

      // Delete user — Prisma cascades handle all related records
      await ctx.prisma.user.delete({ where: { id: ctx.userId } });

      return { success: true };
    }),

  /**
   * Toggles public profile visibility.
   */
  togglePublicProfile: protectedProcedure
    .use(rateLimit("profileUpdate"))
    .input(z.object({ isPublic: z.boolean() }))
    .mutation(async ({ ctx, input }) => {
      await ctx.prisma.user.update({
        where: { id: ctx.userId },
        data: { isPublic: input.isPublic },
      });

      return { success: true };
    }),
});
