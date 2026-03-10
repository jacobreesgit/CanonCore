/**
 * Persistent Vidstack MediaPlayer wrapper.
 * Wraps the app so that all descendants (MiniPlayer, ExpandedViewport,
 * PlaybackKeyboardHandler) can use useMediaState/useMediaRemote hooks.
 *
 * - Always mounts <MediaPlayer> when a track is loaded (context for hooks)
 * - Single <MediaProvider> always mounted, repositioned via CSS
 * - Updates src when currentTrack changes
 * - Handles onEnded for queue advancement (via ref for callback stability)
 * - Listens for onCanPlay to auto-play + resume position
 * - Uses Vidstack's storage prop for volume/mute localStorage persistence
 * - Reads currentTime imperatively from playerRef (no 60fps subscriptions)
 */

"use client";

import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import {
  MediaPlayer,
  MediaProvider,
  useMediaRemote,
  useMediaState,
  type MediaPlayerInstance,
  type PlayerSrc,
} from "@vidstack/react";
import { PlaybackKeyboardHandler } from "./playback-keyboard-handler";
import { MiniPlayer } from "./mini-player";
import { useAppSelector, useAppDispatch } from "@/lib/store/hooks";
import {
  selectCurrentTrack,
  selectIsExpanded,
  selectIsVideoFile,
  selectRepeat,
  selectHasNext,
} from "@/lib/store/selectors";
import {
  setExpanded,
  skipNext,
  skipPrevious,
} from "@/lib/store/playback-slice";
import { updatePlaybackPosition } from "@/lib/item-file-actions";

// ── Stable callback ref helper ──────────────────────────────────────
// Keeps a ref to the latest value so effects don't re-run on changes.
function useLatest<T>(value: T) {
  const ref = useRef(value);
  useLayoutEffect(() => {
    ref.current = value;
  }, [value]);
  return ref;
}

// ── Idle timer for auto-hiding controls ─────────────────────────────
// Returns true when the user has been idle for `delay` ms.
// Stays visible when `stayVisible` is true (e.g., when paused).
function useIdleTimer(delay: number, enabled: boolean, stayVisible: boolean) {
  const [idle, setIdle] = useState(false);

  useEffect(() => {
    if (!enabled || stayVisible) {
      return () => {
        // Reset idle on cleanup so next activation starts fresh
        setIdle(false);
      };
    }

    let timer: ReturnType<typeof setTimeout>;
    let lastActivity = 0;

    const scheduleIdle = () => {
      clearTimeout(timer);
      timer = setTimeout(() => setIdle(true), delay);
    };

    const handleActivity = () => {
      const now = Date.now();
      if (now - lastActivity < 200) return; // Throttle mousemove
      lastActivity = now;
      setIdle(false);
      scheduleIdle();
    };

    handleActivity(); // Start initial timer
    window.addEventListener("mousemove", handleActivity, { passive: true });
    window.addEventListener("touchstart", handleActivity, { passive: true });

    return () => {
      clearTimeout(timer);
      window.removeEventListener("mousemove", handleActivity);
      window.removeEventListener("touchstart", handleActivity);
    };
  }, [delay, enabled, stayVisible]);

  // When disabled or forced visible, always return false
  return enabled && !stayVisible ? idle : false;
}

interface MediaPlayerShellProps {
  children: ReactNode;
}

/**
 * Inner component that lives inside <MediaPlayer> context.
 * Handles auto-play on track change, MediaSession API,
 * and server-side position persistence.
 *
 * Does NOT subscribe to useMediaState("currentTime") to avoid
 * 60fps re-renders — reads currentTime imperatively from playerRef.
 */
function MediaPlayerInner({
  children,
  playerRef,
  canPlayRef,
}: {
  children: ReactNode;
  playerRef: React.RefObject<MediaPlayerInstance | null>;
  canPlayRef: React.MutableRefObject<(() => void) | null>;
}) {
  const dispatch = useAppDispatch();
  const currentTrack = useAppSelector(selectCurrentTrack);
  const isExpanded = useAppSelector(selectIsExpanded);
  const isVideoFile = useAppSelector(selectIsVideoFile);

  const remote = useMediaRemote();
  const paused = useMediaState("paused");
  const waiting = useMediaState("waiting");
  const canPlay = useMediaState("canPlay");
  const isFullscreen = useMediaState("fullscreen");
  const trackIdRef = useRef<string | null>(null);
  const lastSaveRef = useRef<number>(0);
  const pendingAutoPlayRef = useRef(false);

  // ── Auto-hide controls after 3s of inactivity ────────────────────
  const controlsIdle = useIdleTimer(3000, isExpanded, paused);

  // Hide cursor in fullscreen when controls are idle
  useEffect(() => {
    if (controlsIdle && isFullscreen) {
      document.body.classList.add("hide-cursor");
    } else {
      document.body.classList.remove("hide-cursor");
    }
    return () => document.body.classList.remove("hide-cursor");
  }, [controlsIdle, isFullscreen]);

  // ── Auto-play when track changes ──────────────────────────────────
  // Depends on fileId (primitive) not the whole object — avoids extra runs.
  const currentFileId = currentTrack?.fileId ?? null;

  useEffect(() => {
    if (!currentFileId || !currentTrack) return;

    if (trackIdRef.current !== currentFileId) {
      // Save position of previous track imperatively from player ref
      if (trackIdRef.current && playerRef.current) {
        const prevTime = playerRef.current.currentTime;
        if (prevTime > 0) {
          updatePlaybackPosition(
            trackIdRef.current,
            prevTime,
            playerRef.current.duration || null
          );
        }
      }

      trackIdRef.current = currentFileId;
      pendingAutoPlayRef.current = true;
      // Auto-play is triggered by onCanPlay handler, not setTimeout
    }
  }, [currentFileId, currentTrack, playerRef]);

  // Clear trackIdRef when track is removed
  useEffect(() => {
    if (!currentTrack) {
      trackIdRef.current = null;
    }
  }, [currentTrack]);

  // ── onCanPlay handler — triggers auto-play + resume ───────────────
  // Called by MediaPlayer's onCanPlay prop (wired in parent via ref).
  // Reads currentTrack from ref to avoid race condition during rapid switching
  // (canPlay may fire for the previous track's media after a new track is set).
  const currentTrackRef = useLatest(currentTrack);
  const remoteRef = useLatest(remote);

  const handleCanPlay = useCallback(() => {
    if (!pendingAutoPlayRef.current) return;
    const track = currentTrackRef.current;
    const rem = remoteRef.current;
    if (!track) return;

    // Guard: only auto-play if the loaded media matches the current track
    pendingAutoPlayRef.current = false;

    if (track.playbackPosition && track.playbackPosition > 0) {
      rem.seek(track.playbackPosition);
    }
    rem.play();
  }, [currentTrackRef, remoteRef]);

  // Store in ref for parent to wire into <MediaPlayer onCanPlay>
  useLayoutEffect(() => {
    canPlayRef.current = handleCanPlay;
  }, [handleCanPlay, canPlayRef]);

  // ── MediaSession API ──────────────────────────────────────────────
  useEffect(() => {
    if (!("mediaSession" in navigator) || !currentTrack) return;

    navigator.mediaSession.metadata = new MediaMetadata({
      title: currentTrack.filename,
      artist: currentTrack.itemName,
      ...(currentTrack.posterUrl && {
        artwork: [{ src: currentTrack.posterUrl, sizes: "512x512" }],
      }),
    });

    navigator.mediaSession.setActionHandler("play", () => remote.play());
    navigator.mediaSession.setActionHandler("pause", () => remote.pause());
    navigator.mediaSession.setActionHandler("previoustrack", () => {
      // 3s restart check — read currentTime imperatively from player ref
      if (playerRef.current && playerRef.current.currentTime > 3) {
        remote.seek(0);
      } else {
        dispatch(skipPrevious());
      }
    });
    navigator.mediaSession.setActionHandler("nexttrack", () =>
      dispatch(skipNext())
    );

    return () => {
      navigator.mediaSession.setActionHandler("play", null);
      navigator.mediaSession.setActionHandler("pause", null);
      navigator.mediaSession.setActionHandler("previoustrack", null);
      navigator.mediaSession.setActionHandler("nexttrack", null);
    };
  }, [currentTrack, remote, dispatch, playerRef]);

  // ── Position persistence (30s interval) ───────────────────────────
  // No useMediaState("currentTime") subscription — reads imperatively.
  useEffect(() => {
    if (!currentTrack) return;

    const interval = setInterval(() => {
      const now = Date.now();
      if (
        now - lastSaveRef.current >= 30_000 &&
        trackIdRef.current &&
        playerRef.current
      ) {
        const time = playerRef.current.currentTime;
        if (time > 0) {
          lastSaveRef.current = now;
          updatePlaybackPosition(
            trackIdRef.current,
            time,
            playerRef.current.duration || null
          );
        }
      }
    }, 30_000);

    return () => clearInterval(interval);
  }, [currentTrack, playerRef]);

  // ── Position persistence (visibility change) ──────────────────────
  // Reads imperatively — no dependency on currentTime state.
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (
        document.visibilityState === "hidden" &&
        trackIdRef.current &&
        playerRef.current
      ) {
        const now = Date.now();
        if (now - lastSaveRef.current >= 5_000) {
          const time = playerRef.current.currentTime;
          if (time > 0) {
            lastSaveRef.current = now;
            updatePlaybackPosition(
              trackIdRef.current,
              time,
              playerRef.current.duration || null
            );
          }
        }
      }
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);
    return () =>
      document.removeEventListener("visibilitychange", handleVisibilityChange);
  }, [playerRef]);

  // ── Single MediaProvider — always mounted, repositioned via CSS ───
  // When expanded + video: fills the expanded viewport overlay (z-60, fixed).
  // Otherwise: hidden off-screen but still mounted (audio plays in background).
  const isVisibleInViewport = isExpanded && isVideoFile;

  return (
    <>
      {/* Single MediaProvider — CSS repositioned, never unmounted */}
      <div
        data-testid="media-provider-container"
        className={
          isVisibleInViewport
            ? "fixed inset-0 z-[60] flex items-center justify-center bg-black max-lg:bottom-16 [&_video]:h-full [&_video]:w-full [&_video]:object-contain"
            : "pointer-events-none fixed size-0 overflow-hidden opacity-0"
        }
      >
        <MediaProvider />
        {isVisibleInViewport && (waiting || !canPlay) && (
          <div className="pointer-events-none absolute inset-0 flex animate-[fade-in_200ms_750ms_forwards] items-center justify-center opacity-0">
            <div className="size-16 animate-spin rounded-full border-[3px] border-white/10 border-t-white/60" />
          </div>
        )}
      </div>

      {children}
      <MiniPlayer controlsIdle={controlsIdle} />
    </>
  );
}

export function MediaPlayerShell({ children }: MediaPlayerShellProps) {
  const dispatch = useAppDispatch();
  const currentTrack = useAppSelector(selectCurrentTrack);
  const repeat = useAppSelector(selectRepeat);
  const hasNext = useAppSelector(selectHasNext);
  const playerRef = useRef<MediaPlayerInstance>(null);
  const canPlayRef = useRef<(() => void) | null>(null);

  // ── Stable onEnded via ref — avoids Vidstack re-subscribing ───────
  const repeatRef = useLatest(repeat);
  const hasNextRef = useLatest(hasNext);
  const handleEnded = useCallback(() => {
    if (repeatRef.current === "one") {
      // Restart current track
      if (playerRef.current) {
        playerRef.current.currentTime = 0;
        playerRef.current.play();
      }
      return;
    }

    if (hasNextRef.current) {
      dispatch(skipNext());
    } else {
      // No next track — collapse to idle mini player, reset to start.
      // Vidstack queues currentTime updates via canPlayQueue which doesn't
      // process in ended state. Use play() to exit ended, seek, then pause.
      dispatch(setExpanded(false));
      if (playerRef.current) {
        playerRef.current.currentTime = 0;
        playerRef.current
          .play()
          .then(() => playerRef.current?.pause())
          .catch(() => {});
      }
    }
  }, [dispatch, repeatRef, hasNextRef]);

  // Stable onCanPlay prop — delegates to ref without creating a new function each render
  const handleCanPlayProp = useCallback(() => canPlayRef.current?.(), []);

  // Track whether MediaPlayer has ever been mounted. Once mounted, keep it
  // mounted forever (even with no track / src="") so children stay at a stable
  // tree position and React never remounts them (which replays CSS animations).
  // Before first play, render bare children — avoids Vidstack hydration mismatch.
  const [hasEverPlayed, setHasEverPlayed] = useState(false);

  // Adjust state during render — avoids cascading effect setState
  if (currentTrack && !hasEverPlayed) {
    setHasEverPlayed(true);
  }

  // Before any track has played, skip MediaPlayer entirely (SSR-safe)
  if (!hasEverPlayed) {
    return <>{children}</>;
  }

  // Once mounted, always keep <MediaPlayer> in the tree.
  // When no track is loaded, src is empty — Vidstack idles with no media.
  const src = currentTrack
    ? ({
        src: `/api/stream/${currentTrack.fileId}`,
        type: currentTrack.mimeType,
      } as PlayerSrc)
    : ([] as unknown as PlayerSrc);

  return (
    <MediaPlayer
      ref={playerRef}
      src={src}
      viewType={currentTrack?.mimeType.startsWith("video/") ? "video" : "audio"}
      storage="canoncore-player"
      load="eager"
      crossOrigin
      playsInline
      onEnded={handleEnded}
      onCanPlay={handleCanPlayProp}
      keyShortcuts={{ toggleFullscreen: null }}
      className="contents"
    >
      <PlaybackKeyboardHandler />
      <MediaPlayerInner playerRef={playerRef} canPlayRef={canPlayRef}>
        {children}
      </MediaPlayerInner>
    </MediaPlayer>
  );
}
