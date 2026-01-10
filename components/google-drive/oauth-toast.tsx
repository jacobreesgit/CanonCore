/**
 * Client component that shows toast notifications for OAuth results.
 * Reads success/error from URL search params and displays appropriate toast.
 */

"use client";

import { useEffect } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { toast } from "sonner";

/**
 * Shows toast for OAuth callback results.
 * Cleans up URL params after showing toast.
 */
export function OAuthToast() {
  const searchParams = useSearchParams();
  const router = useRouter();

  useEffect(() => {
    const success = searchParams.get("success");
    const error = searchParams.get("error");

    if (success === "connected") {
      toast.success("Google Drive connected successfully");
      // Clean up URL
      router.replace("/my-items", { scroll: false });
    } else if (error) {
      toast.error(`Connection failed: ${error}`);
      // Clean up URL
      router.replace("/my-items", { scroll: false });
    }
  }, [searchParams, router]);

  return null;
}
