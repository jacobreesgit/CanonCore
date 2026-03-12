import { Text, ScrollView } from "@/tw";

export default function ExploreScreen() {
  return (
    <ScrollView
      className="flex-1 bg-background"
      contentContainerClassName="p-5 gap-4"
      contentInsetAdjustmentBehavior="automatic"
    >
      <Text className="text-2xl font-bold text-foreground">Explore</Text>
      <Text className="text-muted-foreground">
        Public items and playlists will appear here.
      </Text>
    </ScrollView>
  );
}
