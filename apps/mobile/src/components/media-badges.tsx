import { View, Text } from "@/tw";
import { formatDuration, getResolutionLabel } from "@canoncore/utils/media";

interface DurationBadgeProps {
  durationMs: number;
}

export function DurationBadge({ durationMs }: DurationBadgeProps) {
  const label = formatDuration(durationMs);
  if (!label) return null;

  return (
    <View className="bg-black/70 rounded px-1.5 py-0.5">
      <Text className="text-white text-xs font-medium">{label}</Text>
    </View>
  );
}

interface ResolutionBadgeProps {
  height: number | null;
}

export function ResolutionBadge({ height }: ResolutionBadgeProps) {
  if (!height) return null;
  const label = getResolutionLabel(height);
  if (!label) return null;

  return (
    <View className="bg-black/70 rounded px-1.5 py-0.5">
      <Text className="text-white text-xs font-medium">{label}</Text>
    </View>
  );
}
