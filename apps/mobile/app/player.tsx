import { View, Text } from "@/tw";

export default function PlayerScreen() {
  return (
    <View className="flex-1 bg-background items-center justify-center">
      <Text className="text-2xl font-bold text-foreground">Player</Text>
      <Text className="text-muted-foreground mt-2">
        Implemented in Plan 8 (Media Playback).
      </Text>
    </View>
  );
}
