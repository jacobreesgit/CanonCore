import { View, Text } from "@/tw";
import { CinematicHero } from "@/components/cinematic-hero";
import { HeroContent } from "@/components/hero-content";

interface ItemDetailHeroProps {
  item: {
    name: string;
    description: string | null;
    dominantColour: string | null;
    tmdbShowTagline: boolean;
    tmdbShowMetadata: boolean;
    tmdbShowGenres: boolean;
  };
  backdropUrl: string | null;
  tagline: string | null;
  year: string | null;
  runtime: string | null;
  genres: string[];
  progressPercentage: number | null;
  children?: React.ReactNode;
}

export function ItemDetailHero({
  item,
  backdropUrl,
  tagline,
  year,
  runtime,
  genres,
  progressPercentage,
  children,
}: ItemDetailHeroProps) {
  // Build metadata line: year · runtime
  const metadataParts: string[] = [];
  if (year) metadataParts.push(year);
  if (runtime) metadataParts.push(runtime);
  const metadataLine = metadataParts.join(" · ");

  // Build subtitle from tagline or description
  const subtitle =
    item.tmdbShowTagline && tagline
      ? tagline
      : item.description
        ? item.description.length > 80
          ? `${item.description.slice(0, 80)}…`
          : item.description
        : undefined;

  return (
    <CinematicHero
      backdropUrl={backdropUrl}
      dominantColour={item.dominantColour}
    >
      <View className="gap-3">
        <HeroContent title={item.name} subtitle={subtitle} />

        {/* Metadata line */}
        {item.tmdbShowMetadata && metadataLine ? (
          <Text className="text-white/60 text-xs">{metadataLine}</Text>
        ) : null}

        {/* Genres */}
        {item.tmdbShowGenres && genres.length > 0 ? (
          <View className="flex-row flex-wrap gap-1.5">
            {genres.slice(0, 4).map((genre) => (
              <View
                key={genre}
                className="bg-white/10 rounded-full px-2.5 py-0.5"
              >
                <Text className="text-white/70 text-xs">{genre}</Text>
              </View>
            ))}
          </View>
        ) : null}

        {/* Progress bar */}
        {progressPercentage != null && progressPercentage > 0 ? (
          <View className="h-1 bg-white/20 rounded-full overflow-hidden">
            <View
              className="h-full bg-primary rounded-full"
              style={{ width: `${Math.min(progressPercentage, 100)}%` }}
            />
          </View>
        ) : null}

        {/* Action buttons slot */}
        {children}
      </View>
    </CinematicHero>
  );
}
