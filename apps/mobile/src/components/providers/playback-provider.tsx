import { createContext, useContext, type ReactNode } from "react";
import { usePlaybackController } from "@/hooks/use-playback-controller";
import { usePositionPersistence } from "@/hooks/use-position-persistence";
import { useAutoWatchRecord } from "@/hooks/use-auto-watch-record";

type PlaybackContextType = ReturnType<typeof usePlaybackController>;

const PlaybackContext = createContext<PlaybackContextType | null>(null);

export function PlaybackProvider({ children }: { children: ReactNode }) {
  const controller = usePlaybackController();

  return (
    <PlaybackContext.Provider value={controller}>
      <PlaybackSideEffects />
      {children}
    </PlaybackContext.Provider>
  );
}

/** Inner component so hooks have access to PlaybackContext */
function PlaybackSideEffects() {
  usePositionPersistence();
  useAutoWatchRecord();
  return null;
}

/**
 * Access the playback controller from any component.
 * Must be used within PlaybackProvider.
 */
export function usePlayback(): PlaybackContextType {
  const ctx = useContext(PlaybackContext);
  if (!ctx) {
    throw new Error("usePlayback must be used within PlaybackProvider");
  }
  return ctx;
}
