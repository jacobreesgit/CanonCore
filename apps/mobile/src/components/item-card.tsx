import { Link } from "expo-router";
import { View, Text, Pressable } from "@/tw";
import { Image } from "@/tw/image";
import { DurationBadge, ResolutionBadge } from "./media-badges";
import { getArtworkUrl, getTmdbPosterUrl } from "@/lib/image-url";

interface ItemCardProps {
  id: string;
  name: string;
  /** Primary artwork file ID (from ItemFile) */
  primaryFileId: string | null;
  /** TMDB poster path (fallback if no primary artwork) */
  tmdbPosterPath: string | null;
  /** Dominant colour hex for placeholder */
  dominantColour: string | null;
  /** Duration in ms of the primary media file */
  primaryDurationMs: number | null;
  /** Height in px of the primary media file (for resolution badge) */
  primaryHeight: number | null;
  /** Number of children (shows count badge for folders) */
  childCount?: number;
  /** Owner username — used to build the link href */
  ownerUsername: string;
  /** Whether this is the current user's own item */
  isOwn?: boolean;
  /** Override the default navigation href (used for folder drill-down) */
  href?: string;
  /** Optional container style override (used by ShelfRow for fixed width) */
  style?: import("react-native").ViewStyle;
  /** Long-press callback — triggers context menu actions */
  onLongPress?: () => void;
}

export function ItemCard({
  id,
  name,
  primaryFileId,
  tmdbPosterPath,
  dominantColour,
  primaryDurationMs,
  primaryHeight,
  childCount,
  ownerUsername,
  isOwn,
  href: hrefOverride,
  style,
  onLongPress,
}: ItemCardProps) {
  const resolvedHref =
    hrefOverride ?? (isOwn ? `/item/${id}` : `/u/${ownerUsername}/${id}`);

  const imageSource = primaryFileId
    ? getArtworkUrl(primaryFileId)
    : tmdbPosterPath
      ? getTmdbPosterUrl(tmdbPosterPath)
      : null;

  return (
    <Link href={resolvedHref} asChild>
      <Pressable className="flex-1 gap-2" style={style} onLongPress={onLongPress}>
        <View
          className="aspect-[2/3] rounded-lg overflow-hidden bg-card"
          style={{ borderCurve: "continuous" }}
        >
          {imageSource ? (
            <Image
              source={imageSource}
              className="w-full h-full object-cover"
              recyclingKey={id}
              transition={200}
            />
          ) : (
            <View
              className="w-full h-full items-center justify-center"
              style={
                dominantColour
                  ? { backgroundColor: dominantColour }
                  : undefined
              }
            >
              <Text className="text-foreground/40 text-lg font-semibold">
                {name.charAt(0).toUpperCase()}
              </Text>
            </View>
          )}

          {/* Badges overlay — top-left */}
          <View className="absolute top-1.5 left-1.5 flex-row gap-1">
            {primaryDurationMs ? (
              <DurationBadge durationMs={primaryDurationMs} />
            ) : null}
            {primaryHeight ? (
              <ResolutionBadge height={primaryHeight} />
            ) : null}
            {childCount && childCount > 0 ? (
              <View className="bg-black/70 rounded px-1.5 py-0.5">
                <Text className="text-white text-xs font-medium">
                  {childCount}
                </Text>
              </View>
            ) : null}
          </View>
        </View>

        <Text
          className="text-foreground text-sm font-medium"
          numberOfLines={2}
        >
          {name}
        </Text>
      </Pressable>
    </Link>
  );
}
