/**
 * Storybook decorator for authentication context.
 * Provides mock NextAuth session for authenticated and unauthenticated states.
 */
import { SessionProvider } from "next-auth/react";

const mockSession = {
  user: {
    id: "user-123",
    name: "Demo User",
    email: "demo@example.com",
    image: null,
  },
  expires: "2099-01-01T00:00:00.000Z",
};

/**
 * Decorator that provides an authenticated session context.
 *
 * @param Story - The story component to wrap
 * @returns Story wrapped with authenticated SessionProvider
 */
export const withAuth = (Story: React.ComponentType) => (
  <SessionProvider session={mockSession}>
    <Story />
  </SessionProvider>
);

/**
 * Decorator that provides an unauthenticated session context.
 *
 * @param Story - The story component to wrap
 * @returns Story wrapped with null session SessionProvider
 */
export const withoutAuth = (Story: React.ComponentType) => (
  <SessionProvider session={null}>
    <Story />
  </SessionProvider>
);
