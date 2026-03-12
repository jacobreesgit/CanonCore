import { useLocalSearchParams } from "expo-router";
import { Text, ScrollView } from "@/tw";

export default function ItemDetailScreen() {
  const { itemId } = useLocalSearchParams<{ itemId: string }>();
  return (
    <ScrollView
      className="flex-1 bg-background"
      contentContainerClassName="p-5 gap-4"
      contentInsetAdjustmentBehavior="automatic"
    >
      <Text className="text-2xl font-bold text-foreground">Item Detail</Text>
      <Text className="text-muted-foreground">Item ID: {itemId}</Text>
      <Text className="text-tertiary-foreground text-sm">
        Implemented in Plan 6 (Item Detail, CRUD & TMDB).
      </Text>
    </ScrollView>
  );
}
