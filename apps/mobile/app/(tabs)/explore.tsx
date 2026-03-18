import { View } from "@/tw";
import { useDebouncedSearch } from "@/hooks/use-debounced-search";
import { SearchBar } from "@/components/search-bar";
import { ExploreTabs } from "@/components/explore/explore-tabs";

export default function ExploreScreen() {
  const { inputValue, debouncedValue, setValue, clear } = useDebouncedSearch();

  return (
    <View className="flex-1 bg-background">
      <SearchBar
        value={inputValue}
        onChangeText={setValue}
        onClear={clear}
        placeholder="Search items and playlists…"
      />
      <ExploreTabs search={debouncedValue} />
    </View>
  );
}
