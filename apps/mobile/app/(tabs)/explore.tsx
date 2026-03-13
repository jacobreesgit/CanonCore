import { View } from "@/tw";
import { SafeAreaView } from "react-native-safe-area-context";
import { useDebouncedSearch } from "@/hooks/use-debounced-search";
import { SearchBar } from "@/components/search-bar";
import { ExploreTabs } from "@/components/explore/explore-tabs";

export default function ExploreScreen() {
  const { inputValue, debouncedValue, setValue, clear } = useDebouncedSearch();

  return (
    <SafeAreaView className="flex-1 bg-background" edges={["top"]}>
      <View className="flex-1">
        <SearchBar
          value={inputValue}
          onChangeText={setValue}
          onClear={clear}
          placeholder="Search items and playlists…"
        />
        <ExploreTabs search={debouncedValue} />
      </View>
    </SafeAreaView>
  );
}
