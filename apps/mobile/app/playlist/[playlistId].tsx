import { useLocalSearchParams } from "expo-router";
import { Text, ScrollView } from "@/tw";

export default function PlaylistDetailScreen() {
  const { playlistId } = useLocalSearchParams<{ playlistId: string }>();
  return (
    <ScrollView
      className="flex-1 bg-background"
      contentContainerClassName="p-5 gap-4"
      contentInsetAdjustmentBehavior="automatic"
    >
      <Text className="text-2xl font-bold text-foreground">Playlist</Text>
      <Text className="text-muted-foreground">Playlist ID: {playlistId}</Text>
    </ScrollView>
  );
}
