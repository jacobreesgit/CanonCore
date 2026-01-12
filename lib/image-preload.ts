/**
 * Image preloading utility for preventing layout shifts.
 * Preloads artwork images before displaying grid views.
 */

/**
 * Preloads images by artwork ID and resolves when all are loaded (or failed).
 * Uses a timeout to prevent indefinite waiting on slow connections.
 *
 * @param artworkIds - Array of artwork file IDs to preload
 * @param timeout - Maximum time to wait in milliseconds (default: 3000)
 */
export function preloadImages(
  artworkIds: string[],
  timeout = 3000
): Promise<void> {
  if (artworkIds.length === 0) {
    return Promise.resolve();
  }

  return new Promise((resolve) => {
    let loaded = 0;
    const total = artworkIds.length;
    let resolved = false;

    const done = () => {
      if (resolved) return;
      resolved = true;
      clearTimeout(timer);
      resolve();
    };

    const checkDone = () => {
      loaded++;
      if (loaded >= total) done();
    };

    const timer = setTimeout(done, timeout);

    artworkIds.forEach((id) => {
      const img = new Image();
      img.onload = checkDone;
      img.onerror = checkDone; // Count errors as done - don't block UI
      img.src = `/api/artwork/${id}`;
    });
  });
}
