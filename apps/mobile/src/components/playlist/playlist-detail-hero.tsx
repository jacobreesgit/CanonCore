import { CinematicHero } from "@/components/cinematic-hero";
import { HeroContent } from "@/components/hero-content";
import {
  getPlaylistArtworkUrl,
  getArtworkUrl,
  getTmdbBackdropUrl,
} from "@/lib/image-url";

interface PlaylistDetailHeroProps {
  playlist: {
    id: string;
    name: string;
    description: string | null;
    dominantColour: string | null;
    hasArtwork: boolean;
    items: Array<{
      item: {
        tmdbBackdropPath: string | null;
        tmdbPosterPath: string | null;
        artworkId: string | null;
      };
    }>;
  };
  itemCount: number;
  children?: React.ReactNode;
}

export function PlaylistDetailHero({
  playlist,
  itemCount,
  children,
}: PlaylistDetailHeroProps) {
  // Resolve backdrop: custom artwork > first item TMDB backdrop > first item artwork
  let backdropUrl: string | null = null;

  if (playlist.hasArtwork) {
    backdropUrl = getPlaylistArtworkUrl(playlist.id);
  } else {
    const firstItem = playlist.items[0]?.item ?? null;
    if (firstItem?.tmdbBackdropPath) {
      backdropUrl = getTmdbBackdropUrl(firstItem.tmdbBackdropPath);
    } else if (firstItem?.artworkId) {
      backdropUrl = getArtworkUrl(firstItem.artworkId);
    }
  }

  const subtitle =
    itemCount === 1 ? "1 item" : `${itemCount} items`;

  return (
    <CinematicHero
      backdropUrl={backdropUrl}
      dominantColour={playlist.dominantColour}
    >
      <HeroContent title={playlist.name} subtitle={subtitle}>
        {children}
      </HeroContent>
    </CinematicHero>
  );
}
