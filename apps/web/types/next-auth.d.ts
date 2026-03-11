/**
 * NextAuth type augmentations.
 * Extends the default NextAuth types to include custom user fields.
 */

import { DefaultSession } from "next-auth";

declare module "next-auth" {
  interface User {
    username?: string | null;
    tokenVersion?: number;
    emailVerified?: Date | null;
  }

  interface Session {
    user: {
      id: string;
      username?: string | null;
      tokenVersion?: number;
      emailVerified?: Date | null;
    } & DefaultSession["user"];
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    id?: string;
    username?: string | null;
    tokenVersion?: number;
    emailVerified?: Date | null;
  }
}
