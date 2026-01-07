/**
 * NextAuth.js v5 configuration with credentials provider.
 * Handles JWT-based session management and user authentication.
 */

import NextAuth, { type Session } from "next-auth";
import Credentials from "next-auth/providers/credentials";
import { compare } from "bcryptjs";
import { prisma } from "@/lib/prisma";

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
 * NextAuth handlers and auth function.
 * - handlers: API route handlers for /api/auth/*
 * - auth: Server-side session retrieval function
 */
export const { handlers, auth } = NextAuth({
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
        });

        if (!user) {
          return null;
        }

        const isPasswordValid = await compare(password, user.passwordHash);

        if (!isPasswordValid) {
          return null;
        }

        return {
          id: user.id,
          email: user.email,
          name: user.name,
          // Return avatar URL if user has image, otherwise null
          image: user.image ? "/api/user/avatar" : null,
        };
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id;
      }
      return token;
    },
    async session({ session, token }) {
      if (token && session.user) {
        session.user.id = token.id as string;
      }
      return session;
    },
  },
});
