import { useState, useCallback } from "react";
import { View, Text, Pressable, ScrollView } from "@/tw";
import { ItemCard } from "@/components/item-card";
import { GridLayout } from "@/components/grid-layout";
import { EmptyState } from "@/components/empty-state";
import { useSession } from "@/ctx";

interface PlaylistItem {
  playlistItemId: string;
  order: number;
  addedAt: Date;
  item: {
    id: string;
    name: string;
    tmdbPosterPath: string | null;
    dominantColour: string | null;
    primaryDurationMs: number | null;
    primaryHeight: number | null;
    artworkId: string | null;
  };
}

type TabKey = "contents" | "about";

interface PlaylistDetailTabsProps {
  items: PlaylistItem[];
  description: string | null;
  isPublic: boolean;
  createdAt: Date;
  ownerUsername: string;
  playlistId: string;
}

const TABS: { key: TabKey; label: string }[] = [
  { key: "contents", label: "Contents" },
  { key: "about", label: "About" },
];

export function PlaylistDetailTabs({
  items,
  description,
  isPublic,
  createdAt,
  ownerUsername,
  playlistId: _playlistId,
}: PlaylistDetailTabsProps) {
  const { user } = useSession();
  const [activeTab, setActiveTab] = useState<TabKey>("contents");

  const renderItem = useCallback(
    ({ item: entry }: { item: PlaylistItem }) => {
      const { item } = entry;
      return (
        <ItemCard
          id={item.id}
          name={item.name}
          primaryFileId={item.artworkId ?? null}
          tmdbPosterPath={item.tmdbPosterPath ?? null}
          dominantColour={item.dominantColour ?? null}
          primaryDurationMs={item.primaryDurationMs ?? null}
          primaryHeight={item.primaryHeight ?? null}
          ownerUsername={ownerUsername}
          isOwn={user?.username === ownerUsername}
        />
      );
    },
    [ownerUsername, user?.username],
  );

  const formattedDate = new Date(createdAt).toLocaleDateString(undefined, {
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  return (
    <View className="flex-1">
      {/* Tab bar */}
      <View className="flex-row border-b border-border">
        {TABS.map((tab) => (
          <Pressable
            key={tab.key}
            onPress={() => setActiveTab(tab.key)}
            className="flex-1 items-center py-3"
          >
            <Text
              className={`text-sm font-medium ${
                activeTab === tab.key
                  ? "text-foreground"
                  : "text-muted-foreground"
              }`}
            >
              {tab.label}
            </Text>
            {activeTab === tab.key ? (
              <View className="absolute bottom-0 left-4 right-4 h-0.5 bg-primary rounded-full" />
            ) : null}
          </Pressable>
        ))}
      </View>

      {/* Tab content */}
      <View className="flex-1">
        {activeTab === "contents" ? (
          items.length === 0 ? (
            <EmptyState
              title="No items"
              message="This playlist has no items yet."
            />
          ) : (
            <GridLayout
              data={items}
              renderItem={renderItem}
              keyExtractor={(entry: PlaylistItem) => entry.playlistItemId}
            />
          )
        ) : (
          <ScrollView
            className="flex-1"
            contentContainerStyle={{ padding: 16, gap: 24 }}
            showsVerticalScrollIndicator={false}
          >
            {/* Description */}
            {description ? (
              <View className="gap-2">
                <Text className="text-foreground text-base font-semibold">
                  About
                </Text>
                <Text
                  className="text-muted-foreground text-sm leading-relaxed"
                  selectable
                >
                  {description}
                </Text>
              </View>
            ) : null}

            {/* Details */}
            <View className="gap-2">
              <Text className="text-foreground text-base font-semibold">
                Details
              </Text>
              <View className="gap-1.5">
                <View className="flex-row gap-2">
                  <Text className="text-muted-foreground text-sm w-24">
                    Items
                  </Text>
                  <Text className="text-foreground text-sm">
                    {items.length === 1 ? "1 item" : `${items.length} items`}
                  </Text>
                </View>
                <View className="flex-row gap-2">
                  <Text className="text-muted-foreground text-sm w-24">
                    Visibility
                  </Text>
                  <Text className="text-foreground text-sm">
                    {isPublic ? "Public" : "Private"}
                  </Text>
                </View>
                <View className="flex-row gap-2">
                  <Text className="text-muted-foreground text-sm w-24">
                    Created
                  </Text>
                  <Text className="text-foreground text-sm">
                    {formattedDate}
                  </Text>
                </View>
              </View>
            </View>
          </ScrollView>
        )}
      </View>
    </View>
  );
}
