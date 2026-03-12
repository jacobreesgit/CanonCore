import { View, Text } from "@/tw";

interface HeroContentProps {
  title: string;
  subtitle?: string;
  children?: React.ReactNode;
}

export function HeroContent({ title, subtitle, children }: HeroContentProps) {
  return (
    <View className="gap-2">
      <Text className="text-white text-2xl font-bold" numberOfLines={2}>
        {title}
      </Text>
      {subtitle ? (
        <Text className="text-white/70 text-sm" numberOfLines={1}>
          {subtitle}
        </Text>
      ) : null}
      {children ? (
        <View className="flex-row gap-3 mt-2">{children}</View>
      ) : null}
    </View>
  );
}
