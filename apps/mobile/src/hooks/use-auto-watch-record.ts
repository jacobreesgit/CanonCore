import { useEffect, useRef } from "react";
import { useTRPC } from "@/lib/trpc";
import { useMutation } from "@tanstack/react-query";
import { useAppSelector } from "@canoncore/store/hooks";
import { selectCurrentTrack } from "@canoncore/store/selectors";

/**
 * Automatically creates a watch record when a track starts playing.
 * Deduplication happens server-side (5-min window).
 */
export function useAutoWatchRecord() {
  const trpc = useTRPC();
  const currentTrack = useAppSelector(selectCurrentTrack);

  const createWatch = useMutation(
    trpc.watch.create.mutationOptions()
  );

  const lastRecordedRef = useRef<string | null>(null);

  useEffect(() => {
    if (!currentTrack) return;
    if (lastRecordedRef.current === currentTrack.itemId) return;

    createWatch.mutate({
      itemId: currentTrack.itemId,
      source: "AUTO",
    });
    lastRecordedRef.current = currentTrack.itemId;
  }, [currentTrack?.itemId]); // eslint-disable-line react-hooks/exhaustive-deps
}
