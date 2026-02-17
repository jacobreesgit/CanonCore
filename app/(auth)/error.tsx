/**
 * Error boundary for authentication routes.
 * Displays a retry option and link back to sign-in.
 */

"use client";

import { useEffect } from "react";
import Link from "next/link";
import * as Sentry from "@sentry/nextjs";
import { Button } from "@/components/ui/button";

export default function AuthError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    Sentry.captureException(error);
  }, [error]);

  return (
    <div className="flex min-h-[50vh] flex-col items-center justify-center gap-4 p-8">
      <div className="text-center">
        <h1 className="text-lg font-semibold">Something went wrong</h1>
        <p className="text-muted-foreground mt-1 text-sm">
          An error occurred. Please try again.
        </p>
      </div>
      <div className="flex gap-3">
        <Button variant="outline" onClick={reset}>
          Try again
        </Button>
        <Button asChild>
          <Link href="/sign-in">Sign in</Link>
        </Button>
      </div>
    </div>
  );
}
