import { Link } from "expo-router";
import { View, Text, Pressable } from "@/tw";
import { Image } from "@/tw/image";
import { FontAwesomeIcon } from "@fortawesome/react-native-fontawesome";
import { faMusic } from "@fortawesome/free-solid-svg-icons";
import {
  getPlaylistArtworkUrl,
  getArtworkUrl,
  getTmdbPosterUrl,
} from "@/lib/image-url";

interface PreviewPoster {
  tmdbPosterPath: string | null;
  artworkId: string | null;
}

interface PlaylistCardProps {
  playlist: {
    id: string;
    name: string;
    itemCount: number;
    hasArtwork: boolean;
    previewPosters: PreviewPoster[];
  };
  href: string;
  ownerUsername?: string;
  onLongPress?: () => void;
}

function MosaicGrid({
  posters,
  playlistId,
}: {
  posters: PreviewPoster[];
  playlistId: string;
}) {
  const cells = Array.from({ length: 4 }, (_, i) => posters[i] ?? null);

  return (
    <View className="w-full h-full flex-row flex-wrap">
      {cells.map((poster, index) => {
        const imageSource = poster?.artworkId
          ? getArtworkUrl(poster.artworkId)
          : poster?.tmdbPosterPath
            ? getTmdbPosterUrl(poster.tmdbPosterPath)
            : null;

        return (
          <View key={index} className="w-1/2 h-1/2">
            {imageSource ? (
              <Image
                source={imageSource}
                className="w-full h-full object-cover"
                recyclingKey={`${playlistId}-mosaic-${index}`}
                transition={200}
              />
            ) : (
              <View className="w-full h-full bg-card/80 items-center justify-center">
                <FontAwesomeIcon
                  icon={faMusic}
                  size={16}
                  color="rgba(255,255,255,0.2)"
                />
              </View>
            )}
          </View>
        );
      })}
    </View>
  );
}

export function PlaylistCard({
  playlist,
  href,
  onLongPress,
}: PlaylistCardProps) {
  const { id, name, itemCount, hasArtwork, previewPosters } = playlist;

  const hasPreviewPosters = previewPosters.some(
    (p) => p.artworkId || p.tmdbPosterPath,
  );

  return (
    <Link href={href as import("expo-router").Href} asChild>
      <Pressable className="flex-1 gap-2" onLongPress={onLongPress}>
        <View
          className="aspect-[2/3] rounded-lg overflow-hidden bg-card"
          style={{ borderCurve: "continuous" }}
        >
          {hasArtwork ? (
            <Image
              source={getPlaylistArtworkUrl(id)}
              className="w-full h-full object-cover"
              recyclingKey={id}
              transition={200}
            />
          ) : hasPreviewPosters ? (
            <MosaicGrid posters={previewPosters} playlistId={id} />
          ) : (
            <View className="w-full h-full items-center justify-center bg-card">
              <FontAwesomeIcon
                icon={faMusic}
                size={32}
                color="rgba(255,255,255,0.3)"
              />
            </View>
          )}
        </View>

        <Text className="text-foreground text-sm font-medium" numberOfLines={2}>
          {name}
        </Text>

        <Text className="text-muted-foreground text-xs -mt-1">
          {itemCount === 1 ? "1 item" : `${itemCount} items`}
        </Text>
      </Pressable>
    </Link>
  );
}
