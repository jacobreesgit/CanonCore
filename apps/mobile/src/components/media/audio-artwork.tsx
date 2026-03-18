import { View } from "@/tw";
import { Image } from "expo-image";
import { FontAwesomeIcon } from "@fortawesome/react-native-fontawesome";
import { faMusic } from "@fortawesome/free-solid-svg-icons";
import { useWindowDimensions } from "react-native";

interface AudioArtworkProps {
  posterUrl?: string;
}

export function AudioArtwork({ posterUrl }: AudioArtworkProps) {
  const { width } = useWindowDimensions();
  const artworkSize = Math.min(width - 64, 320);

  return (
    <View className="items-center justify-center py-8">
      {posterUrl ? (
        <Image
          source={{ uri: posterUrl }}
          style={{
            width: artworkSize,
            height: artworkSize,
            borderRadius: 12,
          }}
          contentFit="cover"
        />
      ) : (
        <View
          className="bg-white/5 items-center justify-center"
          style={{
            width: artworkSize,
            height: artworkSize,
            borderRadius: 12,
          }}
        >
          <FontAwesomeIcon
            icon={faMusic}
            size={64}
            color="rgba(255, 255, 255, 0.2)"
          />
        </View>
      )}
    </View>
  );
}
