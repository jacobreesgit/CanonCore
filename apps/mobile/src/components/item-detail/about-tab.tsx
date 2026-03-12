import { ScrollView, View, Text, Pressable } from "@/tw";
import { useState } from "react";

interface AboutTabProps {
  description: string | null;
  genres: string[];
  tagline: string | null;
  year: string | null;
  runtime: string | null;
}

export function AboutTab({
  description,
  genres,
  tagline,
  year,
  runtime,
}: AboutTabProps) {
  const [isExpanded, setIsExpanded] = useState(false);

  const hasContent = description || genres.length > 0 || tagline;

  if (!hasContent) {
    return (
      <View className="items-center justify-center py-16 px-8">
        <Text className="text-muted-foreground text-center">
          No additional information available.
        </Text>
      </View>
    );
  }

  return (
    <ScrollView
      className="flex-1"
      contentContainerStyle={{ padding: 16, gap: 24 }}
      showsVerticalScrollIndicator={false}
    >
      {/* Description */}
      {description ? (
        <View className="gap-2">
          <Text className="text-foreground text-base font-semibold">About</Text>
          <Pressable onPress={() => setIsExpanded(!isExpanded)}>
            <Text
              className="text-muted-foreground text-sm leading-relaxed"
              numberOfLines={isExpanded ? undefined : 4}
              selectable
            >
              {description}
            </Text>
            {description.length > 200 ? (
              <Text className="text-primary text-sm mt-1">
                {isExpanded ? "Show less" : "Read more"}
              </Text>
            ) : null}
          </Pressable>
        </View>
      ) : null}

      {/* Genres */}
      {genres.length > 0 ? (
        <View className="gap-2">
          <Text className="text-foreground text-base font-semibold">
            Genres
          </Text>
          <View className="flex-row flex-wrap gap-2">
            {genres.map((genre) => (
              <View
                key={genre}
                className="bg-card rounded-full px-3 py-1.5 border border-border"
              >
                <Text className="text-foreground/70 text-sm">{genre}</Text>
              </View>
            ))}
          </View>
        </View>
      ) : null}

      {/* Additional metadata */}
      {year || runtime ? (
        <View className="gap-2">
          <Text className="text-foreground text-base font-semibold">
            Details
          </Text>
          <View className="gap-1.5">
            {year ? (
              <View className="flex-row gap-2">
                <Text className="text-muted-foreground text-sm w-20">Year</Text>
                <Text className="text-foreground text-sm" selectable>
                  {year}
                </Text>
              </View>
            ) : null}
            {runtime ? (
              <View className="flex-row gap-2">
                <Text className="text-muted-foreground text-sm w-20">
                  Runtime
                </Text>
                <Text className="text-foreground text-sm" selectable>
                  {runtime}
                </Text>
              </View>
            ) : null}
          </View>
        </View>
      ) : null}
    </ScrollView>
  );
}
