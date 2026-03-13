import { View, Text } from "@/tw";
import { Image } from "@/tw/image";
import { StyleSheet, useWindowDimensions } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { getPublicAvatarUrl, getPublicHeroUrl } from "@/lib/image-url";

interface PublicProfileHeaderProps {
  profile: {
    id: string;
    username: string;
    name: string | null;
    hasImage: boolean;
    hasHeroImage: boolean;
    bio: string | null;
    createdAt: Date | string;
  };
}

export function PublicProfileHeader({ profile }: PublicProfileHeaderProps) {
  const { width } = useWindowDimensions();
  const heroHeight = width * 0.5;

  const heroUrl = profile.hasHeroImage ? getPublicHeroUrl(profile.id) : null;
  const avatarUrl = profile.hasImage ? getPublicAvatarUrl(profile.id) : null;

  const displayName = profile.name ?? `@${profile.username}`;

  return (
    <View>
      {/* Hero banner */}
      <View style={{ height: heroHeight }}>
        {heroUrl ? (
          <Image
            source={heroUrl}
            className="absolute inset-0 w-full h-full object-cover"
            transition={400}
          />
        ) : (
          <View className="absolute inset-0 bg-card" />
        )}

        {/* Bottom gradient fade */}
        <LinearGradient
          colors={["transparent", "rgba(10,10,10,0.8)", "#0a0a0a"]}
          locations={[0.4, 0.75, 1.0]}
          style={StyleSheet.absoluteFillObject}
        />
      </View>

      {/* Avatar + identity row — overlaps the hero bottom */}
      <View className="px-4 -mt-12 pb-4 gap-3">
        <View className="flex-row items-end gap-4">
          {/* Avatar */}
          <View
            className="w-20 h-20 rounded-full overflow-hidden border-2 border-background bg-card items-center justify-center"
            style={{ borderCurve: "continuous" }}
          >
            {avatarUrl ? (
              <Image
                source={avatarUrl}
                className="w-full h-full object-cover"
                transition={300}
              />
            ) : (
              <Text className="text-foreground text-2xl font-bold">
                {(profile.name ?? profile.username).charAt(0).toUpperCase()}
              </Text>
            )}
          </View>

          {/* Name + username */}
          <View className="flex-1 pb-1 gap-0.5">
            <Text
              className="text-foreground text-lg font-bold"
              numberOfLines={1}
            >
              {displayName}
            </Text>
            <Text className="text-muted-foreground text-sm" numberOfLines={1}>
              @{profile.username}
            </Text>
          </View>
        </View>

        {/* Bio */}
        {profile.bio ? (
          <Text className="text-muted-foreground text-sm leading-5" numberOfLines={4}>
            {profile.bio}
          </Text>
        ) : null}
      </View>
    </View>
  );
}
