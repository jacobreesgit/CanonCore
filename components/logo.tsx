/**
 * CanonCore logo component for auth pages.
 * Uses the same logo as the sidebar for consistency.
 */

import type React from "react";

export function Logo({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div className={`flex items-center gap-1.5 ${className ?? ""}`} {...props}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src="/black.png"
        alt="CanonCore"
        width={24}
        height={24}
        className="h-6 w-auto dark:invert"
      />
      <span className="text-xl font-semibold">CanonCore</span>
    </div>
  );
}
