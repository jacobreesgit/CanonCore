import { View } from "@/tw";
import { Image } from "@/tw/image";
import { StyleSheet, useWindowDimensions } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { useColourPipeline } from "@/hooks/use-colour-pipeline";

interface CinematicHeroProps {
  /** Backdrop image URL (artwork or TMDB backdrop) */
  backdropUrl: string | null;
  /** Dominant colour hex for the colour pipeline */
  dominantColour: string | null;
  /** Content rendered over the gradient overlay */
  children: React.ReactNode;
}

export function CinematicHero({
  backdropUrl,
  dominantColour,
  children,
}: CinematicHeroProps) {
  const { width } = useWindowDimensions();
  const heroHeight = width * 0.75; // 4:3 aspect for hero
  const shades = useColourPipeline(dominantColour);

  // Use shade 900 for gradient base, falling back to default dark background
  const gradientBase = shades?.[900] ?? "#0a0a0a";

  return (
    <View style={{ height: heroHeight }}>
      {/* Backdrop image */}
      {backdropUrl ? (
        <Image
          source={backdropUrl}
          className="absolute inset-0 w-full h-full object-cover"
          transition={500}
        />
      ) : (
        <View
          className="absolute inset-0"
          style={{ backgroundColor: gradientBase }}
        />
      )}

      {/* Gradient overlay — bottom fade */}
      <LinearGradient
        colors={["transparent", `${gradientBase}CC`, gradientBase]}
        locations={[0.3, 0.7, 1.0]}
        style={StyleSheet.absoluteFillObject}
      />

      {/* Content overlay — positioned at bottom */}
      <View className="absolute bottom-0 left-0 right-0 p-4">{children}</View>
    </View>
  );
}
