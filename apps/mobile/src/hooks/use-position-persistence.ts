import { useEffect, useRef, useCallback } from "react";
import { AppState, type AppStateStatus } from "react-native";
import { useTRPC } from "@/lib/trpc";
import { useMutation } from "@tanstack/react-query";
import { useAppSelector } from "@canoncore/store/hooks";
import { selectCurrentTrack } from "@canoncore/store/selectors";
import { usePlayback } from "@/components/providers/playback-provider";
import { useDownloadManager } from "@/components/providers/download-manager-provider";
import TrackPlayer from "react-native-track-player";

const SAVE_INTERVAL_MS = 30_000;

/**
 * Persists playback position to the server every 30 seconds
 * and on track change / app background.
 */
export function usePositionPersistence() {
  const trpc = useTRPC();
  const currentTrack = useAppSelector(selectCurrentTrack);
  const { activePlayer, videoPlayer } = usePlayback();
  const downloadManager = useDownloadManager();

  const savePosition = useMutation(
    trpc.itemFile.updatePlaybackPosition.mutationOptions(),
  );

  const currentTrackRef = useRef(currentTrack);
  currentTrackRef.current = currentTrack;
  const activePlayerRef = useRef(activePlayer);
  activePlayerRef.current = activePlayer;
  const videoPlayerRef = useRef(videoPlayer);
  videoPlayerRef.current = videoPlayer;
  const savePositionRef = useRef(savePosition);
  savePositionRef.current = savePosition;

  const lastSavedRef = useRef<{ fileId: string; position: number } | null>(
    null,
  );

  const getPosition = useCallback(async (): Promise<{
    position: number;
    duration: number;
  } | null> => {
    const track = currentTrackRef.current;
    if (!track) return null;

    if (activePlayerRef.current === "audio") {
      const progress = await TrackPlayer.getProgress();
      return {
        position: progress.position,
        duration: progress.duration,
      };
    } else if (activePlayerRef.current === "video") {
      return {
        position: videoPlayerRef.current.currentTime,
        duration: videoPlayerRef.current.duration,
      };
    }
    return null;
  }, []);

  const downloadManagerRef = useRef(downloadManager);
  downloadManagerRef.current = downloadManager;

  const doSave = useCallback(async () => {
    const track = currentTrackRef.current;
    if (!track) return;
    const pos = await getPosition();
    if (!pos || pos.position <= 0 || pos.duration <= 0) return;

    // Skip if position hasn't changed significantly (>2s)
    if (
      lastSavedRef.current?.fileId === track.fileId &&
      Math.abs(lastSavedRef.current.position - pos.position) < 2
    ) {
      return;
    }

    // Update LRU timestamp for offline downloads (proves user actually watched/listened)
    downloadManagerRef.current.markPlayed(track.fileId).catch(() => {
      // Non-critical — file may not be downloaded
    });

    // Save position to server (silently fails when offline, succeeds next interval)
    savePositionRef.current.mutate({
      fileId: track.fileId,
      position: pos.position,
      duration: pos.duration,
    });

    lastSavedRef.current = {
      fileId: track.fileId,
      position: pos.position,
    };
  }, [getPosition]);

  // 30-second interval save
  useEffect(() => {
    if (!currentTrack) return;

    const interval = setInterval(doSave, SAVE_INTERVAL_MS);
    return () => clearInterval(interval);
  }, [currentTrack?.fileId, doSave]); // eslint-disable-line react-hooks/exhaustive-deps

  // Save on track change
  const prevTrackRef = useRef<string | null>(null);
  useEffect(() => {
    if (prevTrackRef.current && prevTrackRef.current !== currentTrack?.fileId) {
      doSave();
    }
    prevTrackRef.current = currentTrack?.fileId ?? null;
  }, [currentTrack?.fileId, doSave]);

  // Save on app background
  useEffect(() => {
    const handleAppState = (state: AppStateStatus) => {
      if (state === "background" || state === "inactive") {
        doSave();
      }
    };

    const subscription = AppState.addEventListener("change", handleAppState);
    return () => subscription.remove();
  }, [doSave]);
}
