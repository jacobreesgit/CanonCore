/**
 * Hook for lazy loading with Intersection Observer.
 * Supports priority loading for above-fold images.
 */

import { useState, useRef, useEffect, useCallback } from "react";

/**
 * Options for useLazyImage hook.
 */
interface UseLazyImageOptions {
  /** Load immediately without waiting for viewport (default: false) */
  priority?: boolean;
  /** Distance from viewport to start loading (default: "200px") */
  rootMargin?: string;
}

/**
 * Return type for useLazyImage hook.
 */
interface UseLazyImageReturn {
  /** Callback ref to attach to the container element */
  ref: React.RefCallback<HTMLElement>;
  /** Whether the image should start loading */
  shouldLoad: boolean;
}

/**
 * Hook for lazy loading images with Intersection Observer.
 * Use priority=true for above-fold images that should load immediately.
 * Non-priority images wait until they enter the viewport (plus rootMargin).
 *
 * @param options.priority - Load immediately (default: false)
 * @param options.rootMargin - Preload distance from viewport (default: "200px")
 * @returns ref callback and shouldLoad state
 *
 * @example
 * const { ref, shouldLoad } = useLazyImage({ priority: index < 4 });
 * <div ref={ref}>
 *   {shouldLoad && <img src={src} />}
 * </div>
 */
export function useLazyImage(
  options: UseLazyImageOptions = {}
): UseLazyImageReturn {
  const { priority = false, rootMargin = "200px" } = options;
  const [shouldLoad, setShouldLoad] = useState(priority);
  const [element, setElement] = useState<HTMLElement | null>(null);
  const observerRef = useRef<IntersectionObserver | null>(null);

  const ref = useCallback((node: HTMLElement | null) => {
    setElement(node);
  }, []);

  useEffect(() => {
    // If priority or already loading, skip observer
    if (priority || shouldLoad || !element) return;

    // Fallback for environments without IntersectionObserver
    if (typeof IntersectionObserver === "undefined") {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- intentional fallback for SSR/old browsers
      setShouldLoad(true);
      return;
    }

    observerRef.current = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            setShouldLoad(true);
            observerRef.current?.unobserve(entry.target);
          }
        });
      },
      { rootMargin: `${rootMargin} 0px`, threshold: 0 }
    );

    observerRef.current.observe(element);

    return () => observerRef.current?.disconnect();
  }, [element, priority, rootMargin, shouldLoad]);

  return { ref, shouldLoad };
}
