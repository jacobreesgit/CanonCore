/**
 * Custom Vidstack media player icons using Font Awesome.
 * Replaces Vidstack's default icons for visual consistency.
 */

import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import type { IconDefinition } from "@fortawesome/fontawesome-svg-core";
import type { DefaultLayoutIcons } from "@vidstack/react/player/layouts/default";
import {
  faPlay,
  faPause,
  faRepeat,
  faVolumeXmark,
  faVolumeLow,
  faVolumeHigh,
  faClosedCaptioning,
  faWindowRestore,
  faMaximize,
  faMinimize,
  faRotateLeft,
  faRotateRight,
  faDownload,
  faUniversalAccess,
  faArrowLeft,
  faArrowRight,
  faHeadphones,
  faChevronUp,
  faChevronDown,
  faVideo,
  faCirclePlay,
  faGear,
  faTextHeight,
  faDroplet,
  faCheck,
  faDisplay,
} from "@fortawesome/free-solid-svg-icons";
import { faChromecast } from "@fortawesome/free-brands-svg-icons";

/**
 * Wraps a Font Awesome icon definition into a named React component
 * compatible with Vidstack's DefaultLayoutIcon interface.
 */
const wrap = (icon: IconDefinition) =>
  function FAIcon(props: { className?: string }) {
    return <FontAwesomeIcon icon={icon} className={props.className ?? ""} />;
  };

export const mediaPlayerIcons: DefaultLayoutIcons = {
  AirPlayButton: {
    Default: wrap(faDisplay),
    Connecting: wrap(faDisplay),
    Connected: wrap(faDisplay),
  },
  GoogleCastButton: {
    Default: wrap(faChromecast),
    Connecting: wrap(faChromecast),
    Connected: wrap(faChromecast),
  },
  PlayButton: {
    Play: wrap(faPlay),
    Pause: wrap(faPause),
    Replay: wrap(faRepeat),
  },
  MuteButton: {
    Mute: wrap(faVolumeXmark),
    VolumeLow: wrap(faVolumeLow),
    VolumeHigh: wrap(faVolumeHigh),
  },
  CaptionButton: {
    On: wrap(faClosedCaptioning),
    Off: wrap(faClosedCaptioning),
  },
  PIPButton: {
    Enter: wrap(faWindowRestore),
    Exit: wrap(faWindowRestore),
  },
  FullscreenButton: {
    Enter: wrap(faMaximize),
    Exit: wrap(faMinimize),
  },
  SeekButton: {
    Backward: wrap(faRotateLeft),
    Forward: wrap(faRotateRight),
  },
  DownloadButton: {
    Default: wrap(faDownload),
  },
  Menu: {
    Accessibility: wrap(faUniversalAccess),
    ArrowLeft: wrap(faArrowLeft),
    ArrowRight: wrap(faArrowRight),
    Audio: wrap(faHeadphones),
    AudioBoostUp: wrap(faChevronUp),
    AudioBoostDown: wrap(faChevronDown),
    Chapters: wrap(faVideo),
    Captions: wrap(faClosedCaptioning),
    Playback: wrap(faCirclePlay),
    Settings: wrap(faGear),
    SpeedUp: wrap(faChevronUp),
    SpeedDown: wrap(faChevronDown),
    QualityUp: wrap(faChevronUp),
    QualityDown: wrap(faChevronDown),
    FontSizeUp: wrap(faTextHeight),
    FontSizeDown: wrap(faTextHeight),
    OpacityUp: wrap(faDroplet),
    OpacityDown: wrap(faDroplet),
    RadioCheck: wrap(faCheck),
  },
  KeyboardDisplay: {
    Play: wrap(faPlay),
    Pause: wrap(faPause),
    Mute: wrap(faVolumeXmark),
    VolumeUp: wrap(faVolumeHigh),
    VolumeDown: wrap(faVolumeLow),
    EnterFullscreen: wrap(faMaximize),
    ExitFullscreen: wrap(faMinimize),
    EnterPiP: wrap(faWindowRestore),
    ExitPiP: wrap(faWindowRestore),
    CaptionsOn: wrap(faClosedCaptioning),
    CaptionsOff: wrap(faClosedCaptioning),
    SeekForward: wrap(faRotateRight),
    SeekBackward: wrap(faRotateLeft),
  },
};
