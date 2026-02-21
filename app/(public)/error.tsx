/**
 * Error boundary for public routes (explore, profiles, items).
 * Displays a retry option with cinematic styling.
 */

"use client";

import { useEffect } from "react";
import Link from "next/link";
import * as Sentry from "@sentry/nextjs";
import { Button } from "@/components/ui/button";

export default function PublicError({
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
    <div className="flex flex-1 flex-col items-center justify-center gap-4 p-8">
      <div className="text-center">
        <h1 className="text-lg font-semibold">Something went wrong</h1>
        <p className="text-muted-foreground mt-1 text-sm">
          We couldn&apos;t load this page. Please try again.
        </p>
      </div>
      <div className="flex gap-3">
        <Button variant="outline" onClick={reset}>
          Try again
        </Button>
        <Button asChild>
          <Link href="/explore">Explore</Link>
        </Button>
      </div>
    </div>
  );
}
