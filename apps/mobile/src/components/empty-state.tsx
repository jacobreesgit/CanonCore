import { View, Text } from "@/tw";

interface EmptyStateProps {
  title: string;
  message: string;
}

export function EmptyState({ title, message }: EmptyStateProps) {
  return (
    <View className="items-center justify-center py-16 px-8">
      <Text className="text-foreground text-lg font-semibold mb-2">
        {title}
      </Text>
      <Text className="text-muted-foreground text-center">{message}</Text>
    </View>
  );
}
