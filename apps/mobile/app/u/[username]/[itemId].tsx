import { useLocalSearchParams } from "expo-router";
import { Text, ScrollView } from "@/tw";

export default function PublicItemDetailScreen() {
  const { username, itemId } = useLocalSearchParams<{ username: string; itemId: string }>();
  return (
    <ScrollView
      className="flex-1 bg-background"
      contentContainerClassName="p-5 gap-4"
      contentInsetAdjustmentBehavior="automatic"
    >
      <Text className="text-2xl font-bold text-foreground">Public Item</Text>
      <Text className="text-muted-foreground">@{username} / {itemId}</Text>
    </ScrollView>
  );
}
