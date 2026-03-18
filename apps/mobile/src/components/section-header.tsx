import { View, Text, Pressable } from "@/tw";

interface SectionHeaderProps {
  title: string;
  actionLabel?: string;
  onAction?: () => void;
}

export function SectionHeader({
  title,
  actionLabel,
  onAction,
}: SectionHeaderProps) {
  const sectionId = `section-${title.toLowerCase().replace(/\s+/g, "-")}`;
  return (
    <View
      testID={sectionId}
      className="flex-row items-center justify-between px-4 py-2"
    >
      <Text className="text-foreground text-lg font-bold">{title}</Text>
      {actionLabel && onAction ? (
        <Pressable onPress={onAction}>
          <Text className="text-primary text-sm font-medium">
            {actionLabel}
          </Text>
        </Pressable>
      ) : null}
    </View>
  );
}
