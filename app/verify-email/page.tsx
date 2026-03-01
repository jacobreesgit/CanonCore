/**
 * Email verification landing page.
 * Validates token from URL params and verifies the email.
 * Placed outside (auth) route group so it works for both
 * authenticated (email change) and unauthenticated (signup) users.
 */

import type { Metadata } from "next";
import Link from "next/link";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faCircleCheck,
  faCircleXmark,
} from "@fortawesome/free-solid-svg-icons";
import { verifyEmail } from "@/lib/auth-actions";

export const metadata: Metadata = {
  title: "Verify Email - CanonCore",
  description: "Verify your email address.",
};

export default async function VerifyEmailPage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string }>;
}) {
  const { token } = await searchParams;

  if (!token) {
    return (
      <main
        id="main-content"
        className="flex min-h-screen flex-col items-center justify-center p-6"
      >
        <div className="w-full max-w-sm space-y-4 text-center">
          <FontAwesomeIcon
            icon={faCircleXmark}
            className="text-destructive size-12"
          />
          <h1 className="text-2xl font-bold">Invalid Link</h1>
          <p className="text-muted-foreground">
            This verification link is invalid or missing a token.
          </p>
          <Link
            href="/sign-in"
            className="text-primary focus-visible:ring-ring mt-4 inline-block underline focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none"
          >
            Go to sign in
          </Link>
        </div>
      </main>
    );
  }

  const result = await verifyEmail(token);

  return (
    <main
      id="main-content"
      className="flex min-h-screen flex-col items-center justify-center p-6"
    >
      <div className="w-full max-w-sm space-y-4 text-center">
        {result.success ? (
          <>
            <FontAwesomeIcon
              icon={faCircleCheck}
              className="size-12 text-green-500"
            />
            <h1 className="text-2xl font-bold">Email Verified</h1>
            <p className="text-muted-foreground">
              Your email address has been verified successfully.
            </p>
            <Link
              href="/sign-in"
              className="text-primary focus-visible:ring-ring mt-4 inline-block underline focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none"
            >
              Continue to sign in
            </Link>
          </>
        ) : (
          <>
            <FontAwesomeIcon
              icon={faCircleXmark}
              className="text-destructive size-12"
            />
            <h1 className="text-2xl font-bold">Verification Failed</h1>
            <p className="text-muted-foreground">{result.error}</p>
            <Link
              href="/sign-in"
              className="text-primary focus-visible:ring-ring mt-4 inline-block underline focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none"
            >
              Go to sign in
            </Link>
          </>
        )}
      </div>
    </main>
  );
}
