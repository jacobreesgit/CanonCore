import { Text, ScrollView } from "@/tw";

export default function LibraryScreen() {
  return (
    <ScrollView
      className="flex-1 bg-background"
      contentContainerClassName="p-5 gap-4"
      contentInsetAdjustmentBehavior="automatic"
    >
      <Text className="text-2xl font-bold text-foreground">Library</Text>
      <Text className="text-muted-foreground">
        Your media library grid will appear here.
      </Text>
    </ScrollView>
  );
}
