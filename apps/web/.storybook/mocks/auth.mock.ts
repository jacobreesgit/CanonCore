/**
 * Mock for lib/auth.ts
 * Prevents prisma and bcryptjs from being imported in Storybook's browser build.
 */

import { fn } from "storybook/test";

/**
 * User data for sidebar display.
 */
export interface SidebarUser {
  name: string;
  email: string;
  avatar?: string;
  username?: string | null;
  isPublic?: boolean;
  hasImage?: boolean;
  hasHeroImage?: boolean;
  bio?: string | null;
}

/**
 * Mock session type.
 */
export interface Session {
  user?: {
    id?: string;
    name?: string | null;
    email?: string | null;
    image?: string | null;
    username?: string | null;
  };
}

/**
 * Mock for extractSidebarUser function.
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
 * Mock for getExtendedSidebarUser function.
 */
export const getExtendedSidebarUser = fn(
  async (session: Session | null): Promise<SidebarUser | null> => {
    if (!session?.user) {
      return null;
    }

    return {
      name: session.user.name ?? "Mock User",
      email: session.user.email ?? "mock@example.com",
      avatar: undefined,
      username: session.user.username ?? "mockuser",
      isPublic: true,
      hasImage: false,
      hasHeroImage: false,
    };
  }
);

/**
 * Mock for auth function (NextAuth session retrieval).
 */
export const auth = fn(
  async (): Promise<Session | null> => ({
    user: {
      id: "mock-user-id",
      name: "Mock User",
      email: "mock@example.com",
      image: null,
      username: "mockuser",
    },
  })
);

/**
 * Mock handlers for API routes.
 */
export const handlers = {
  GET: fn(async () => new Response(null, { status: 200 })),
  POST: fn(async () => new Response(null, { status: 200 })),
};
