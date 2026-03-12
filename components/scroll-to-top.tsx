"use client";

import { usePathname } from "next/navigation";
import { useEffect, useRef } from "react";

/**
 * Scrolls the nearest scrollable parent to the top on route changes.
 * Needed because the app uses a custom scrollable container (not window),
 * so Next.js default scroll restoration doesn't work.
 */
export function ScrollToTop() {
  const pathname = usePathname();
  const prevPathname = useRef(pathname);

  useEffect(() => {
    if (pathname !== prevPathname.current) {
      prevPathname.current = pathname;
      document.getElementById("main-content")?.scrollTo(0, 0);
    }
  }, [pathname]);

  return null;
}
