import TrackPlayer, {
  Capability,
  AppKilledPlaybackBehavior,
  RepeatMode,
} from "react-native-track-player";

let isInitialised = false;

/**
 * Initialise react-native-track-player with capabilities.
 * Safe to call multiple times — no-ops after first init.
 */
export async function initTrackPlayer(): Promise<void> {
  if (isInitialised) return;

  try {
    await TrackPlayer.setupPlayer({
      maxBuffer: 300,
    });

    await TrackPlayer.updateOptions({
      capabilities: [
        Capability.Play,
        Capability.Pause,
        Capability.SkipToNext,
        Capability.SkipToPrevious,
        Capability.SeekTo,
        Capability.JumpForward,
        Capability.JumpBackward,
        Capability.Stop,
      ],
      compactCapabilities: [
        Capability.Play,
        Capability.Pause,
        Capability.SkipToNext,
      ],
      forwardJumpInterval: 15,
      backwardJumpInterval: 15,
      android: {
        appKilledPlaybackBehavior:
          AppKilledPlaybackBehavior.ContinuePlayback,
      },
    });

    await TrackPlayer.setRepeatMode(RepeatMode.Off);

    isInitialised = true;
  } catch (error) {
    // setupPlayer throws if already initialised (hot reload)
    if (
      error instanceof Error &&
      error.message.includes("already been initialized")
    ) {
      isInitialised = true;
    } else {
      throw error;
    }
  }
}

/**
 * Map Redux RepeatMode to RNTP RepeatMode.
 */
export function toRNTPRepeatMode(
  mode: "off" | "one" | "all"
): RepeatMode {
  switch (mode) {
    case "off":
      return RepeatMode.Off;
    case "one":
      return RepeatMode.Track;
    case "all":
      return RepeatMode.Queue;
  }
}
