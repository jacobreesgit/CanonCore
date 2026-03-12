import { FlatList } from "react-native";
import { ItemCard } from "./item-card";

interface ShelfItem {
  id: string;
  name: string;
  tmdbPosterPath: string | null;
  artworkId: string | null;
  childCount: number;
  playbackProgress: number | null;
}

interface ShelfRowProps {
  items: ShelfItem[];
  isOwn?: boolean;
  ownerUsername: string;
}

export function ShelfRow({ items, isOwn, ownerUsername }: ShelfRowProps) {
  return (
    <FlatList
      data={items}
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={{ paddingHorizontal: 16, gap: 12 }}
      keyExtractor={(item) => item.id}
      renderItem={({ item }) => (
        <ItemCard
          id={item.id}
          name={item.name}
          primaryFileId={item.artworkId}
          tmdbPosterPath={item.tmdbPosterPath}
          dominantColour={null}
          primaryDurationMs={null}
          primaryHeight={null}
          childCount={item.childCount}
          ownerUsername={ownerUsername}
          isOwn={isOwn}
          style={{ width: 140 }}
        />
      )}
    />
  );
}
