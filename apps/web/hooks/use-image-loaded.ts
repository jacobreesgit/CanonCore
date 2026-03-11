/**
 * Hook for robust image loading that handles cached images.
 * Cached images load before React attaches onLoad, so we check
 * img.complete + img.naturalHeight on mount to detect them.
 */

import { useState, useRef, useLayoutEffect, useCallback } from "react";

/**
 * Return type for the useImageLoaded hook.
 */
interface UseImageLoadedReturn {
  /** MutableRefObject because useRef(null) returns mutable ref, not RefObject */
  ref: React.MutableRefObject<HTMLImageElement | null>;
  /** Whether the image has successfully loaded */
  loaded: boolean;
  /** Whether the image failed to load */
  error: boolean;
  /** Callback for img onLoad event */
  onLoad: () => void;
  /** Callback for img onError event */
  onError: () => void;
}

/**
 * Hook for robust image loading that handles cached images.
 *
 * Browser-cached images may load synchronously before React attaches
 * the onLoad handler, causing images to stay at opacity: 0 forever.
 * This hook checks img.complete + img.naturalHeight on mount to detect
 * cached images and set loaded state correctly.
 *
 * @param src - Image source URL (resets state on change)
 * @returns ref, loaded/error state, and event handlers
 *
 * @example
 * const { ref, loaded, error, onLoad, onError } = useImageLoaded(src);
 * <img ref={ref} src={src} onLoad={onLoad} onError={onError}
 *      className={loaded ? "opacity-100" : "opacity-0"} />
 */
export function useImageLoaded(src?: string): UseImageLoadedReturn {
  const ref = useRef<HTMLImageElement | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState(false);

  // Combined: Reset state and detect cached images on src change
  // useLayoutEffect runs synchronously before paint, avoiding flash for cached images
  useLayoutEffect(() => {
    // Reset state when src changes - necessary to handle image src transitions
    // eslint-disable-next-line react-hooks/set-state-in-effect -- intentional reset on src change
    setLoaded(false);
    setError(false);

    const img = ref.current;
    if (!img) return;

    // img.complete = true for cached images
    // img.naturalHeight > 0 confirms successful load (not error)
    if (img.complete && img.naturalHeight > 0) {
      setLoaded(true);
    }
  }, [src]);

  const onLoad = useCallback(() => {
    setLoaded(true);
    setError(false);
  }, []);

  const onError = useCallback(() => {
    setLoaded(false);
    setError(true);
  }, []);

  return { ref, loaded, error, onLoad, onError };
}
