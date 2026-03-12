import { Text, ScrollView } from "@/tw";

export default function HomeScreen() {
  return (
    <ScrollView
      className="flex-1 bg-background"
      contentContainerClassName="p-5 gap-4"
      contentInsetAdjustmentBehavior="automatic"
    >
      <Text className="text-2xl font-bold text-foreground">Home</Text>
      <Text className="text-muted-foreground">
        Continue watching, recent items, and shelves will appear here.
      </Text>
    </ScrollView>
  );
}
