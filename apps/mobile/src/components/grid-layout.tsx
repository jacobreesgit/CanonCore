import {
  FlatList,
  View,
  useWindowDimensions,
  type ListRenderItem,
  ActivityIndicator,
} from "react-native";
import { View as TwView } from "@/tw";

interface GridLayoutProps<T> {
  data: T[];
  renderItem: ListRenderItem<T>;
  keyExtractor: (item: T) => string;
  onEndReached?: () => void;
  isLoadingMore?: boolean;
  isRefreshing?: boolean;
  onRefresh?: () => void;
  ListHeaderComponent?: React.ReactElement | null;
  ListEmptyComponent?: React.ReactElement | null;
  contentInsetAdjustmentBehavior?: "automatic" | "never";
}

export function GridLayout<T>({
  data,
  renderItem,
  keyExtractor,
  onEndReached,
  isLoadingMore,
  isRefreshing,
  onRefresh,
  ListHeaderComponent,
  ListEmptyComponent,
  contentInsetAdjustmentBehavior = "automatic",
}: GridLayoutProps<T>) {
  const { width } = useWindowDimensions();
  const numColumns = width >= 768 ? 3 : 2;
  const gap = 12;

  return (
    <FlatList
      data={data}
      renderItem={({ item, index, ...rest }) => (
        <View testID={`item-card-${index}`} style={{ flex: 1 }}>
          {renderItem({ item, index, ...rest })}
        </View>
      )}
      keyExtractor={keyExtractor}
      numColumns={numColumns}
      key={`grid-${numColumns}`}
      contentContainerStyle={{ padding: 16, gap }}
      columnWrapperStyle={{ gap }}
      onEndReached={onEndReached}
      onEndReachedThreshold={0.5}
      refreshing={isRefreshing}
      onRefresh={onRefresh}
      ListHeaderComponent={ListHeaderComponent}
      ListEmptyComponent={ListEmptyComponent}
      ListFooterComponent={
        isLoadingMore ? (
          <TwView className="py-4 items-center">
            <ActivityIndicator color="#ffffff" />
          </TwView>
        ) : null
      }
      contentInsetAdjustmentBehavior={contentInsetAdjustmentBehavior}
      showsVerticalScrollIndicator={false}
    />
  );
}
