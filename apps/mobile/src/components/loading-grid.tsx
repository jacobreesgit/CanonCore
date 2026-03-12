import { View } from "@/tw";
import Animated, { FadeIn } from "react-native-reanimated";
import { useWindowDimensions } from "react-native";

export function LoadingGrid({ count = 6 }: { count?: number }) {
  const { width } = useWindowDimensions();
  const numColumns = width >= 768 ? 3 : 2;
  const gap = 12;
  const padding = 16;
  const itemWidth = (width - padding * 2 - gap * (numColumns - 1)) / numColumns;

  return (
    <Animated.View
      entering={FadeIn.duration(200)}
      style={{
        flexDirection: "row",
        flexWrap: "wrap",
        padding,
        gap,
      }}
    >
      {Array.from({ length: count }).map((_, i) => (
        <View
          key={i}
          className="bg-card rounded-lg"
          style={{
            width: itemWidth,
            aspectRatio: 2 / 3,
            borderCurve: "continuous",
          }}
        />
      ))}
    </Animated.View>
  );
}
