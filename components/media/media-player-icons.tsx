/**
 * Custom Vidstack media player icons using Lucide React.
 * Replaces Vidstack's default icons for visual consistency.
 */

import type { DefaultLayoutIcons } from "@vidstack/react/player/layouts/default";
import {
  Airplay,
  ArrowLeft,
  ArrowRight,
  Cast,
  Check,
  ChevronDown,
  ChevronUp,
  CirclePlay,
  Download,
  Maximize,
  Minimize,
  Pause,
  PictureInPicture,
  PictureInPicture2,
  Play,
  Repeat,
  RotateCcw,
  RotateCw,
  Settings,
  Subtitles,
  Volume1,
  Volume2,
  VolumeOff,
  Accessibility,
  Headphones,
  ListVideo,
  ALargeSmall,
  Droplets,
} from "lucide-react";

export const mediaPlayerIcons: DefaultLayoutIcons = {
  AirPlayButton: {
    Default: Airplay,
    Connecting: Airplay,
    Connected: Airplay,
  },
  GoogleCastButton: {
    Default: Cast,
    Connecting: Cast,
    Connected: Cast,
  },
  PlayButton: {
    Play: Play,
    Pause: Pause,
    Replay: Repeat,
  },
  MuteButton: {
    Mute: VolumeOff,
    VolumeLow: Volume1,
    VolumeHigh: Volume2,
  },
  CaptionButton: {
    On: Subtitles,
    Off: Subtitles,
  },
  PIPButton: {
    Enter: PictureInPicture,
    Exit: PictureInPicture2,
  },
  FullscreenButton: {
    Enter: Maximize,
    Exit: Minimize,
  },
  SeekButton: {
    Backward: RotateCcw,
    Forward: RotateCw,
  },
  DownloadButton: {
    Default: Download,
  },
  Menu: {
    Accessibility: Accessibility,
    ArrowLeft: ArrowLeft,
    ArrowRight: ArrowRight,
    Audio: Headphones,
    AudioBoostUp: ChevronUp,
    AudioBoostDown: ChevronDown,
    Chapters: ListVideo,
    Captions: Subtitles,
    Playback: CirclePlay,
    Settings: Settings,
    SpeedUp: ChevronUp,
    SpeedDown: ChevronDown,
    QualityUp: ChevronUp,
    QualityDown: ChevronDown,
    FontSizeUp: ALargeSmall,
    FontSizeDown: ALargeSmall,
    OpacityUp: Droplets,
    OpacityDown: Droplets,
    RadioCheck: Check,
  },
  KeyboardDisplay: {
    Play: Play,
    Pause: Pause,
    Mute: VolumeOff,
    VolumeUp: Volume2,
    VolumeDown: Volume1,
    EnterFullscreen: Maximize,
    ExitFullscreen: Minimize,
    EnterPiP: PictureInPicture,
    ExitPiP: PictureInPicture2,
    CaptionsOn: Subtitles,
    CaptionsOff: Subtitles,
    SeekForward: RotateCw,
    SeekBackward: RotateCcw,
  },
};
