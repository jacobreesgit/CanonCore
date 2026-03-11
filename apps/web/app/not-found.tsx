/**
 * Custom 404 page for the entire application.
 * Shown when no route matches the requested URL.
 */

import Link from "next/link";
import { Button } from "@/components/ui/button";

export default function NotFound() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-4 p-8">
      <div className="text-6xl font-bold text-neutral-700">404</div>
      <div className="text-center">
        <h1 className="text-lg font-semibold">Page not found</h1>
        <p className="text-muted-foreground mt-1 text-sm">
          The page you&apos;re looking for doesn&apos;t exist.
        </p>
      </div>
      <div className="flex gap-3">
        <Button variant="outline" asChild>
          <Link href="/">Go home</Link>
        </Button>
        <Button asChild>
          <Link href="/explore">Explore</Link>
        </Button>
      </div>
    </div>
  );
}
