/**
 * React hook for responsive mobile detection.
 * Uses matchMedia API for efficient viewport monitoring.
 */

import * as React from "react";

const MOBILE_BREAKPOINT = 1024;

/**
 * Detects if the current viewport is mobile-sized.
 * Updates reactively when window is resized across breakpoint.
 *
 * @returns true if viewport width is less than 1024px
 */
export function useIsMobile() {
  const [isMobile, setIsMobile] = React.useState<boolean | undefined>(
    undefined
  );

  React.useEffect(() => {
    const mql = window.matchMedia(`(max-width: ${MOBILE_BREAKPOINT - 1}px)`);
    const onChange = () => {
      setIsMobile(window.innerWidth < MOBILE_BREAKPOINT);
    };
    mql.addEventListener("change", onChange);
    setIsMobile(window.innerWidth < MOBILE_BREAKPOINT);
    return () => mql.removeEventListener("change", onChange);
  }, []);

  return !!isMobile;
}
