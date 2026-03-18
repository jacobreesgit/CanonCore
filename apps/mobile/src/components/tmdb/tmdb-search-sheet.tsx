import { useCallback } from "react";
import { View, Text, TextInput, Pressable } from "@/tw";
import { Modal, ActivityIndicator, FlatList } from "react-native";
import { Image } from "@/tw/image";
import { FontAwesomeIcon } from "@fortawesome/react-native-fontawesome";
import { faXmark, faMagnifyingGlass } from "@fortawesome/free-solid-svg-icons";
import { useTRPC } from "@/lib/trpc";
import { useMutation } from "@tanstack/react-query";
import { useDebouncedSearch } from "@/hooks/use-debounced-search";
import { getTmdbPosterUrl } from "@/lib/image-url";
import { useEffect } from "react";

export interface TmdbResult {
  id: number;
  title: string;
  mediaType: "movie" | "tv";
  year: string;
  posterPath: string | null;
  backdropPath: string | null;
  overview: string;
}

interface TmdbSearchSheetProps {
  visible: boolean;
  onClose: () => void;
  onSelect: (result: TmdbResult) => void;
}

export function TmdbSearchSheet({
  visible,
  onClose,
  onSelect,
}: TmdbSearchSheetProps) {
  const trpc = useTRPC();
  const { inputValue, debouncedValue, setValue, clear } =
    useDebouncedSearch(500);

  // tmdb.search is a mutation (calls external TMDB API)
  const searchMutation = useMutation(trpc.tmdb.search.mutationOptions());

  // Trigger search when debounced value changes
  useEffect(() => {
    if (debouncedValue.length >= 2) {
      searchMutation.mutate({ query: debouncedValue });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debouncedValue]);

  const results: TmdbResult[] = (searchMutation.data ?? []) as TmdbResult[];

  const renderResult = useCallback(
    ({ item }: { item: TmdbResult }) => (
      <Pressable
        onPress={() => onSelect(item)}
        className="flex-row gap-3 px-4 py-3 active:bg-white/5"
      >
        {item.posterPath ? (
          <Image
            source={getTmdbPosterUrl(item.posterPath, "w185")}
            className="rounded bg-card"
            style={{ width: 48, height: 72 }}
            transition={200}
          />
        ) : (
          <View
            className="bg-card rounded items-center justify-center"
            style={{ width: 48, height: 72 }}
          >
            <Text className="text-foreground/30 text-sm">?</Text>
          </View>
        )}
        <View className="flex-1 gap-1 justify-center">
          <Text
            className="text-foreground text-sm font-medium"
            numberOfLines={2}
          >
            {item.title}
          </Text>
          <View className="flex-row gap-2">
            {item.year ? (
              <Text className="text-muted-foreground text-xs">{item.year}</Text>
            ) : null}
            <Text className="text-muted-foreground text-xs uppercase">
              {item.mediaType === "movie" ? "Movie" : "TV Show"}
            </Text>
          </View>
          {item.overview ? (
            <Text className="text-muted-foreground text-xs" numberOfLines={2}>
              {item.overview}
            </Text>
          ) : null}
        </View>
      </Pressable>
    ),
    [onSelect],
  );

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="formSheet"
      onRequestClose={onClose}
    >
      <View className="flex-1 bg-background">
        {/* Header */}
        <View className="flex-row items-center justify-between px-4 py-3 border-b border-border">
          <Pressable onPress={onClose}>
            <FontAwesomeIcon icon={faXmark} size={18} color="#ffffff" />
          </Pressable>
          <Text className="text-foreground text-base font-semibold">
            TMDB Search
          </Text>
          <View style={{ width: 18 }} />
        </View>

        {/* Search input */}
        <View className="flex-row items-center bg-card mx-4 mt-3 rounded-lg px-3 py-2.5 gap-2">
          <FontAwesomeIcon
            icon={faMagnifyingGlass}
            size={14}
            color="rgba(255, 255, 255, 0.4)"
          />
          <TextInput
            className="flex-1 text-foreground text-base"
            value={inputValue}
            onChangeText={setValue}
            placeholder="Search movies & TV shows..."
            placeholderTextColor="rgba(255, 255, 255, 0.3)"
            autoFocus
            autoCapitalize="none"
            returnKeyType="search"
          />
          {inputValue.length > 0 ? (
            <Pressable onPress={clear} hitSlop={8}>
              <FontAwesomeIcon
                icon={faXmark}
                size={14}
                color="rgba(255, 255, 255, 0.4)"
              />
            </Pressable>
          ) : null}
        </View>

        {/* Results */}
        {searchMutation.isPending ? (
          <View className="items-center py-8">
            <ActivityIndicator color="#ffffff" />
          </View>
        ) : results.length > 0 ? (
          <FlatList
            data={results}
            renderItem={renderResult}
            keyExtractor={(item) => `${item.mediaType}-${item.id}`}
            contentContainerStyle={{ paddingVertical: 8 }}
            keyboardShouldPersistTaps="handled"
          />
        ) : debouncedValue.length >= 2 ? (
          <View className="items-center py-8">
            <Text className="text-muted-foreground">No results found</Text>
          </View>
        ) : (
          <View className="items-center py-8">
            <Text className="text-muted-foreground">
              Search for a movie or TV show
            </Text>
          </View>
        )}
      </View>
    </Modal>
  );
}
