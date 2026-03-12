import { useLocalSearchParams } from "expo-router";
import { Text, ScrollView } from "@/tw";

export default function PublicProfileScreen() {
  const { username } = useLocalSearchParams<{ username: string }>();
  return (
    <ScrollView
      className="flex-1 bg-background"
      contentContainerClassName="p-5 gap-4"
      contentInsetAdjustmentBehavior="automatic"
    >
      <Text className="text-2xl font-bold text-foreground">@{username}</Text>
      <Text className="text-muted-foreground">Public profile</Text>
    </ScrollView>
  );
}
