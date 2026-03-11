/**
 * Custom 404 page for public routes.
 * Shown when a profile or item is not found.
 */

import Link from "next/link";
import { Button } from "@/components/ui/button";

export default function PublicNotFound() {
  return (
    <div className="flex min-h-[50vh] flex-col items-center justify-center gap-4 p-8">
      <div className="text-5xl font-bold text-neutral-700">404</div>
      <div className="text-center">
        <h1 className="text-lg font-semibold">Not found</h1>
        <p className="text-muted-foreground mt-1 text-sm">
          This profile or item doesn&apos;t exist or isn&apos;t public.
        </p>
      </div>
      <Button asChild>
        <Link href="/explore">Explore public items</Link>
      </Button>
    </div>
  );
}
