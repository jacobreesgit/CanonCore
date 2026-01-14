/**
 * Hook for tracking browser online/offline status.
 * Listens to online/offline events and updates state accordingly.
 */

import { useState, useEffect } from "react";

/**
 * Returns the current online status of the browser.
 * Updates automatically when the connection status changes.
 *
 * @returns True if the browser is online, false otherwise
 *
 * @example
 * function MyComponent() {
 *   const isOnline = useOnlineStatus();
 *   return <div>{isOnline ? 'Online' : 'Offline'}</div>;
 * }
 */
export function useOnlineStatus(): boolean {
  const [isOnline, setIsOnline] = useState(() => {
    // Default to true for SSR, will be corrected on mount
    if (typeof navigator === "undefined") {
      return true;
    }
    return navigator.onLine;
  });

  useEffect(() => {
    function handleOnline() {
      setIsOnline(true);
    }

    function handleOffline() {
      setIsOnline(false);
    }

    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);

    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, []);

  return isOnline;
}
