/**
 * NextAuth.js v5 configuration with credentials provider.
 * Handles JWT-based session management and user authentication.
 */

import { cache } from "react";
import NextAuth, { type Session } from "next-auth";
import Credentials from "next-auth/providers/credentials";
import { compare } from "bcryptjs";
import { prisma } from "@/lib/prisma";
import {
  isAccountLocked,
  handleFailedLogin,
  handleSuccessfulLogin,
} from "@/lib/lockout-utils";

/**
 * User data for sidebar display.
 */
export interface SidebarUser {
  /** Display name for the user */
  name: string;
  /** User's email address */
  email: string;
  /** URL to user's avatar image */
  avatar?: string;
  /** User's username for public profile */
  username?: string | null;
  /** Whether user's profile is public */
  isPublic?: boolean;
  /** Whether user has a profile image */
  hasImage?: boolean;
  /** Whether user has a hero image */
  hasHeroImage?: boolean;
  /** User bio for public profile */
  bio?: string | null;
}

/**
 * Extracts sidebar user data from a NextAuth session.
 * Returns null if the session or user is not available.
 *
 * @param session - NextAuth session object
 * @returns Sidebar user data or null for unauthenticated users
 */
export function extractSidebarUser(
  session: Session | null
): SidebarUser | null {
  if (!session?.user) {
    return null;
  }

  return {
    name: session.user.name ?? session.user.email?.split("@")[0] ?? "User",
    email: session.user.email ?? "",
    avatar: session.user.image ?? undefined,
  };
}

/**
 * Fetches extended user data from the database for sidebar display.
 * Includes username, isPublic, and image flags not stored in JWT.
 *
 * @param session - NextAuth session object
 * @returns Extended sidebar user data or null for unauthenticated users
 */
export async function getExtendedSidebarUser(
  session: Session | null
): Promise<SidebarUser | null> {
  if (!session?.user?.id) {
    return null;
  }

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: {
      name: true,
      email: true,
      username: true,
      isPublic: true,
      image: true,
      heroImage: true,
      bio: true,
    },
  });

  if (!user) {
    return null;
  }

  return {
    name: user.name ?? user.email.split("@")[0] ?? "User",
    email: user.email,
    avatar: user.image ? "/api/user/avatar" : undefined,
    username: user.username,
    isPublic: user.isPublic,
    hasImage: user.image !== null,
    hasHeroImage: user.heroImage !== null,
    bio: user.bio ?? null,
  };
}

/**
 * NextAuth handlers and raw auth function.
 * - handlers: API route handlers for /api/auth/*
 * - uncachedAuth: Raw session retrieval (use `auth` instead)
 */
export const { handlers, auth: uncachedAuth } = NextAuth({
  session: {
    strategy: "jwt",
  },
  pages: {
    signIn: "/sign-in",
    error: "/sign-in",
  },
  providers: [
    Credentials({
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) {
          return null;
        }

        const email = credentials.email as string;
        const password = credentials.password as string;

        const user = await prisma.user.findUnique({
          where: { email },
          select: {
            id: true,
            email: true,
            passwordHash: true,
            name: true,
            username: true,
            image: true,
            emailVerified: true,
            tokenVersion: true,
            failedLoginAttempts: true,
            lockedUntil: true,
          },
        });

        if (!user) {
          return null;
        }

        // Check account lockout
        const lockoutCheck = isAccountLocked(user);
        if (lockoutCheck.locked) {
          return null;
        }

        const isPasswordValid = await compare(password, user.passwordHash);

        if (!isPasswordValid) {
          // Increment failed attempts, lock if threshold reached
          await prisma.user.update({
            where: { id: user.id },
            data: handleFailedLogin(user),
          });
          return null;
        }

        // Successful login — reset lockout counters (including expired locks)
        if (user.failedLoginAttempts > 0 || user.lockedUntil) {
          await prisma.user.update({
            where: { id: user.id },
            data: handleSuccessfulLogin(),
          });
        }

        return {
          id: user.id,
          email: user.email,
          name: user.name,
          image: user.image ? "/api/user/avatar" : null,
          username: user.username,
          tokenVersion: user.tokenVersion,
          emailVerified: user.emailVerified,
        };
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user }) {
      if (user?.id) {
        token.id = user.id;
        token.username = user.username;
        token.tokenVersion = user.tokenVersion;
        token.emailVerified = user.emailVerified;
      }

      // On subsequent requests, check if tokenVersion is stale
      if (token.id && !user) {
        const dbUser = await prisma.user.findUnique({
          where: { id: token.id as string },
          select: { tokenVersion: true },
        });
        if (!dbUser || dbUser.tokenVersion !== token.tokenVersion) {
          // Token version mismatch — force sign-out
          return { ...token, id: undefined };
        }
      }

      return token;
    },
    session({ session, token }) {
      if (token.id) {
        session.user.id = token.id as string;
        session.user.username = (token.username as string) ?? null;
        session.user.emailVerified = token.emailVerified as Date | null;
      }
      return session;
    },
  },
});

/**
 * Cached auth function — deduplicates per-request.
 * Prevents redundant JWT decode/validation when auth()
 * is called from layout, page, and server actions within
 * the same React server component render tree.
 */
export const auth = cache(uncachedAuth);
