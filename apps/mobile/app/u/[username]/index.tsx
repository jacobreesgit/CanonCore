import { useLocalSearchParams } from "expo-router";
import { View, Text } from "@/tw";
import { ActivityIndicator, ScrollView } from "react-native";
import { Stack } from "expo-router/stack";
import { useTRPC } from "@/lib/trpc";
import { useQuery } from "@tanstack/react-query";
import { SearchBar } from "@/components/search-bar";
import { useDebouncedSearch } from "@/hooks/use-debounced-search";
import { PublicProfileHeader } from "@/components/public/public-profile-header";
import { PublicProfileTabs } from "@/components/public/public-profile-tabs";

export default function PublicProfileScreen() {
  const { username } = useLocalSearchParams<{ username: string }>();
  const trpc = useTRPC();
  const { inputValue, debouncedValue, setValue, clear } =
    useDebouncedSearch(300);

  const profileQuery = useQuery(
    trpc.public.getProfile.queryOptions({ username }),
  );

  // Loading state
  if (profileQuery.isLoading) {
    return (
      <View className="flex-1 bg-background items-center justify-center">
        <Stack.Screen options={{ title: "" }} />
        <ActivityIndicator color="#ffffff" />
      </View>
    );
  }

  // Error / not found
  if (profileQuery.isError || !profileQuery.data) {
    return (
      <View className="flex-1 bg-background items-center justify-center px-8">
        <Stack.Screen options={{ title: "Profile not found" }} />
        <Text className="text-foreground text-lg font-semibold mb-2">
          Profile not found
        </Text>
        <Text className="text-muted-foreground text-center">
          This profile doesn&apos;t exist or is private.
        </Text>
      </View>
    );
  }

  const profile = profileQuery.data;

  return (
    <View className="flex-1 bg-background">
      <Stack.Screen
        options={{
          title: profile.name ?? `@${profile.username}`,
          headerTransparent: true,
        }}
      />

      <ScrollView
        className="flex-1"
        contentInsetAdjustmentBehavior="automatic"
        showsVerticalScrollIndicator={false}
        stickyHeaderIndices={[1]}
      >
        {/* Hero + avatar + bio */}
        <PublicProfileHeader profile={profile} />

        {/* Search bar — sticky */}
        <View className="bg-background pt-2 pb-1">
          <SearchBar
            value={inputValue}
            onChangeText={setValue}
            onClear={clear}
            placeholder="Search this profile..."
          />
        </View>

        {/* Items + Playlists tabs */}
        <PublicProfileTabs
          userId={profile.id}
          username={profile.username}
          search={debouncedValue}
        />
      </ScrollView>
    </View>
  );
}
