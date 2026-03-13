import { View } from "@/tw";
import {
  CastButton as NativeCastButton,
  useCastState,
  CastState,
} from "react-native-google-cast";
import type { ViewStyle } from "react-native";

interface CastButtonWrapperProps {
  style?: ViewStyle;
  /** Size of the cast icon in points */
  size?: number;
  /** Tint color for the icon */
  tintColor?: string;
}

/**
 * Cast button that only renders when Chromecast devices are discoverable.
 * Uses the native Google Cast SDK button which handles all device selection UI.
 */
export function CastButtonWrapper({
  style,
  size = 24,
  tintColor = "#ffffff",
}: CastButtonWrapperProps) {
  const castState = useCastState();

  // Don't render if no devices are available
  if (castState === CastState.NO_DEVICES_AVAILABLE) {
    return null;
  }

  return (
    <View style={style}>
      <NativeCastButton
        style={{ width: size, height: size, tintColor }}
      />
    </View>
  );
}
