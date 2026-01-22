/**
 * Auth pages layout.
 * Redirects authenticated users to their profile since they don't need auth pages.
 */

import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

interface AuthLayoutProps {
  children: React.ReactNode;
}

/**
 * Layout for authentication pages (sign-in, sign-up, forgot-password, reset-password).
 * Redirects already-authenticated users to their profile.
 */
export default async function AuthLayout({ children }: AuthLayoutProps) {
  const session = await auth();

  // Only redirect if we have a fully valid session with user ID
  // AND the user actually exists in the database (handles stale sessions after DB reseed)
  if (session?.user?.id) {
    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { id: true, username: true },
    });

    if (user) {
      // Redirect to user's profile if they have a username, otherwise homepage
      redirect(user.username ? `/u/${user.username}` : "/");
    }
    // If user doesn't exist in DB (stale session), let them continue to sign-in
  }

  return children;
}
