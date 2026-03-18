import { useCallback, useEffect, useRef, useState } from "react";
import { useCastSession, useRemoteMediaClient } from "react-native-google-cast";
import { useAppSelector } from "@canoncore/store/hooks";
import { selectCurrentTrack, selectQueue } from "@canoncore/store/selectors";
import { buildCastMediaRequest, buildCastQueue } from "@/lib/cast-media";

export interface CastPlaybackState {
  /** Whether a cast session is active */
  isCasting: boolean;
  /** Name of connected device (e.g. "Living Room TV") */
  deviceName: string | null;
  /** Send the current track (or a specific track) to the cast device */
  castCurrentTrack: (startTime?: number) => void;
  /** Send the entire queue to the cast device */
  castQueue: () => void;
  /** Stop casting and return to local playback */
  stopCasting: () => void;
}

export function useCastPlayback(): CastPlaybackState {
  const castSession = useCastSession();
  const client = useRemoteMediaClient();

  const currentTrack = useAppSelector(selectCurrentTrack);
  const queue = useAppSelector(selectQueue);
  const queueIndex = useAppSelector((state) => state.playback.queueIndex);

  const isCasting = !!castSession;
  const [deviceName, setDeviceName] = useState<string | null>(null);

  // Track whether we initiated the cast so we can resume local playback
  const wasCastingRef = useRef(false);

  // Resolve device friendly name when session connects
  useEffect(() => {
    if (castSession) {
      castSession.getCastDevice().then((device) => {
        setDeviceName(device?.friendlyName ?? null);
      });
    } else {
      setDeviceName(null);
    }
  }, [castSession]);

  const castCurrentTrack = useCallback(
    (startTime = 0) => {
      if (!client || !currentTrack) return;
      const request = buildCastMediaRequest(currentTrack, startTime);
      client.loadMedia(request);
    },
    [client, currentTrack],
  );

  const castQueue = useCallback(() => {
    if (!client || queue.length === 0) return;
    const request = buildCastQueue(queue, queueIndex);
    client.loadMedia(request);
  }, [client, queue, queueIndex]);

  const stopCasting = useCallback(() => {
    if (client) {
      client.stop();
    }
  }, [client]);

  // When cast session starts, send current media to cast device
  useEffect(() => {
    if (isCasting && !wasCastingRef.current && currentTrack) {
      wasCastingRef.current = true;
      if (queue.length > 1) {
        castQueue();
      } else {
        castCurrentTrack(currentTrack.playbackPosition ?? 0);
      }
    }

    if (!isCasting && wasCastingRef.current) {
      wasCastingRef.current = false;
    }
  }, [isCasting, currentTrack, castCurrentTrack, castQueue, queue.length]);

  return {
    isCasting,
    deviceName,
    castCurrentTrack,
    castQueue,
    stopCasting,
  };
}
