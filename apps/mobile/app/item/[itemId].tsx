import { useState } from "react";
import { useLocalSearchParams } from "expo-router";
import { View, Text, ScrollView, Pressable } from "@/tw";
import { ActivityIndicator } from "react-native";
import { Stack } from "expo-router/stack";
import { useTRPC } from "@/lib/trpc";
import { useQuery } from "@tanstack/react-query";
import {
  getArtworkUrl,
  getTmdbBackdropUrl,
  getTmdbPosterUrl,
} from "@/lib/image-url";
import { FontAwesomeIcon } from "@fortawesome/react-native-fontawesome";
import { faPlay } from "@fortawesome/free-solid-svg-icons";
import { useAppDispatch } from "@canoncore/store/hooks";
import { DownloadButton } from "@/components/downloads/download-button";
import { playTrack, playQueue } from "@canoncore/store/playback";
import { buildMobileQueueTrack } from "@/lib/queue-helpers";

import { ItemDetailHero } from "@/components/item-detail/item-detail-hero";
import { ItemDetailTabs } from "@/components/item-detail/item-detail-tabs";
import { WatchStatusButton } from "@/components/item-detail/watch-status-button";
import { ItemActionsMenu } from "@/components/item-detail/item-actions-menu";
import { EditItemSheet } from "@/components/item-form/edit-item-sheet";
import { CreateItemSheet } from "@/components/item-form/create-item-sheet";
import { TmdbSearchSheet } from "@/components/tmdb/tmdb-search-sheet";
import { TmdbConfirmSheet } from "@/components/tmdb/tmdb-confirm-sheet";
import type { TmdbResult } from "@/components/tmdb/tmdb-search-sheet";
import { AddToPlaylistSheet } from "@/components/playlist/add-to-playlist-sheet";
import { CreatePlaylistSheet } from "@/components/playlist/create-playlist-sheet";

export default function ItemDetailScreen() {
  const { itemId } = useLocalSearchParams<{ itemId: string }>();
  const trpc = useTRPC();

  const appDispatch = useAppDispatch();

  // Sheet visibility state
  const [editVisible, setEditVisible] = useState(false);
  const [createVisible, setCreateVisible] = useState(false);
  const [tmdbSearchVisible, setTmdbSearchVisible] = useState(false);
  const [tmdbConfirmVisible, setTmdbConfirmVisible] = useState(false);
  const [selectedTmdbResult, setSelectedTmdbResult] =
    useState<TmdbResult | null>(null);
  const [addToPlaylistVisible, setAddToPlaylistVisible] = useState(false);
  const [createPlaylistFromAddVisible, setCreatePlaylistFromAddVisible] =
    useState(false);

  // Data fetching — item.get returns { item, ancestors }
  const itemQuery = useQuery(trpc.item.get.queryOptions({ id: itemId }));

  // itemFile.list returns { media, artwork, subtitles }
  const filesQuery = useQuery(
    trpc.itemFile.list.queryOptions({ itemId }, { enabled: !!itemQuery.data }),
  );

  const watchQuery = useQuery(
    trpc.watch.getStatus.queryOptions(
      { itemId },
      { enabled: !!itemQuery.data },
    ),
  );

  // Fetch children to determine if item has children
  const childrenQuery = useQuery(
    trpc.item.list.queryOptions(
      { parentId: itemId },
      { enabled: !!itemQuery.data },
    ),
  );

  // Loading state
  if (itemQuery.isLoading) {
    return (
      <View className="flex-1 bg-background items-center justify-center">
        <Stack.Screen options={{ title: "" }} />
        <ActivityIndicator color="#ffffff" />
      </View>
    );
  }

  // Error state
  if (itemQuery.isError || !itemQuery.data) {
    return (
      <View className="flex-1 bg-background items-center justify-center px-8">
        <Stack.Screen options={{ title: "Error" }} />
        <Text className="text-foreground text-lg font-semibold mb-2">
          Item not found
        </Text>
        <Text className="text-muted-foreground text-center">
          This item may have been deleted or you don&apos;t have access.
        </Text>
      </View>
    );
  }

  // item.get returns { item, ancestors }
  const item = itemQuery.data.item;
  const filesData = filesQuery.data;
  const isWatched = watchQuery.data?.isWatched ?? false;
  const hasChildren = (childrenQuery.data ?? []).length > 0;

  // Flatten grouped files for the FilesList component
  const allFiles = [
    ...(filesData?.media ?? []).map((f) => ({
      ...f,
      fileType: "MEDIA" as const,
    })),
    ...(filesData?.artwork ?? []).map((f) => ({
      ...f,
      fileType: "ARTWORK" as const,
    })),
    ...(filesData?.subtitles ?? []).map((f) => ({
      ...f,
      fileType: "SUBTITLE" as const,
    })),
  ];

  // Serialize files for FilesList (handle BigInt size → number)
  const serializedFiles = allFiles.map((f) => ({
    id: f.id,
    filename: f.filename,
    fileType: f.fileType,
    mimeType: f.mimeType ?? null,
    size: f.size != null ? Number(f.size) : null,
    isPrimary: f.isPrimary ?? false,
    isHero: f.isHero ?? false,
    durationMs: f.durationMs != null ? Number(f.durationMs) : null,
    width: f.width ?? null,
    height: f.height ?? null,
  }));

  const hasMedia = serializedFiles.some((f) => f.fileType === "MEDIA");

  // Handle file press — play media files
  const handleFilePress = (file: {
    id: string;
    filename: string;
    fileType: string;
    mimeType: string | null;
    durationMs: number | null;
  }) => {
    if (file.fileType !== "MEDIA") return;

    const heroFile = serializedFiles.find((f) => f.isHero);

    const track = buildMobileQueueTrack({
      fileId: file.id,
      itemId: itemId,
      filename: file.filename,
      mimeType: file.mimeType,
      itemName: item.name,
      tmdbPosterPath: item.tmdbPosterPath,
      heroArtworkId: heroFile?.id ?? null,
      durationMs: file.durationMs,
      playbackPosition: null,
    });

    const mediaFiles = serializedFiles.filter((f) => f.fileType === "MEDIA");
    if (mediaFiles.length > 1) {
      const tracks = mediaFiles.map((f) =>
        buildMobileQueueTrack({
          fileId: f.id,
          itemId: itemId,
          filename: f.filename,
          mimeType: f.mimeType,
          itemName: item.name,
          tmdbPosterPath: item.tmdbPosterPath,
          heroArtworkId: heroFile?.id ?? null,
          durationMs: f.durationMs,
          playbackPosition: null,
        }),
      );
      const startIndex = mediaFiles.findIndex((f) => f.id === file.id);
      appDispatch(playQueue({ tracks, startIndex: Math.max(startIndex, 0) }));
    } else {
      appDispatch(playTrack(track));
    }
  };

  // Resolve backdrop URL: hero artwork > TMDB backdrop
  const heroFile = allFiles.find((f) => f.isHero);
  const backdropUrl = heroFile
    ? getArtworkUrl(heroFile.id)
    : item.tmdbBackdropPath
      ? getTmdbBackdropUrl(item.tmdbBackdropPath)
      : null;

  // TMDB wizard flow
  const handleTmdbSelect = (result: TmdbResult) => {
    setSelectedTmdbResult(result);
    setTmdbSearchVisible(false);
    setTmdbConfirmVisible(true);
  };

  const handleTmdbConfirm = () => {
    setTmdbConfirmVisible(false);
    setSelectedTmdbResult(null);
  };

  return (
    <View className="flex-1 bg-background">
      <Stack.Screen options={{ title: item.name, headerTransparent: true }} />

      <ScrollView
        testID="item-detail-screen"
        className="flex-1"
        contentInsetAdjustmentBehavior="automatic"
        showsVerticalScrollIndicator={false}
      >
        {/* Hero section */}
        <ItemDetailHero
          item={{
            name: item.name,
            description: item.description,
            dominantColour: item.dominantColour,
            tmdbShowTagline: item.tmdbShowTagline,
            tmdbShowMetadata: item.tmdbShowMetadata,
            tmdbShowGenres: item.tmdbShowGenres,
          }}
          backdropUrl={backdropUrl}
          tagline={null}
          year={null}
          runtime={null}
          genres={[]}
          progressPercentage={null}
        >
          {/* Action buttons */}
          <View className="flex-row gap-2">
            {hasMedia ? (
              <>
                <Pressable
                  testID="play-button"
                  onPress={() => {
                    const primaryMedia = serializedFiles.find(
                      (f) => f.fileType === "MEDIA" && f.isPrimary,
                    );
                    const firstMedia = serializedFiles.find(
                      (f) => f.fileType === "MEDIA",
                    );
                    const mediaFile = primaryMedia ?? firstMedia;
                    if (mediaFile) {
                      handleFilePress(mediaFile);
                    }
                  }}
                  className="flex-row items-center gap-2 bg-primary rounded-lg px-5 py-2.5"
                >
                  <FontAwesomeIcon icon={faPlay} size={14} color="#ffffff" />
                  <Text className="text-white text-sm font-semibold">Play</Text>
                </Pressable>
                {(() => {
                  const primaryMedia = serializedFiles.find(
                    (f) => f.fileType === "MEDIA" && f.isPrimary,
                  );
                  const firstMedia = serializedFiles.find(
                    (f) => f.fileType === "MEDIA",
                  );
                  const primaryMediaFile = primaryMedia ?? firstMedia;
                  if (!primaryMediaFile) return null;
                  const posterUrl = item.tmdbPosterPath
                    ? getTmdbPosterUrl(item.tmdbPosterPath)
                    : heroFile
                      ? getArtworkUrl(heroFile.id)
                      : null;
                  return (
                    <DownloadButton
                      fileId={primaryMediaFile.id}
                      downloadInput={{
                        fileId: primaryMediaFile.id,
                        itemId: itemId,
                        filename: primaryMediaFile.filename,
                        mimeType:
                          primaryMediaFile.mimeType ??
                          "application/octet-stream",
                        itemName: item.name,
                        posterUrl: posterUrl,
                        totalBytes: primaryMediaFile.size ?? 0,
                      }}
                    />
                  );
                })()}
              </>
            ) : null}
            <WatchStatusButton itemId={itemId} initialIsWatched={isWatched} />
            <ItemActionsMenu
              itemId={itemId}
              itemName={item.name}
              isWatched={isWatched}
              hasChildren={hasChildren}
              onEdit={() => setEditVisible(true)}
              onAddChild={() => setCreateVisible(true)}
              onAddToPlaylist={() => setAddToPlaylistVisible(true)}
              onTmdb={() => setTmdbSearchVisible(true)}
            />
          </View>
        </ItemDetailHero>

        {/* Tabs */}
        <ItemDetailTabs
          itemId={itemId}
          hasChildren={hasChildren}
          description={item.description}
          genres={[]}
          tagline={null}
          year={null}
          runtime={null}
          files={serializedFiles}
          onFilePress={handleFilePress}
          itemName={item.name}
          posterUrl={
            item.tmdbPosterPath
              ? getTmdbPosterUrl(item.tmdbPosterPath)
              : heroFile
                ? getArtworkUrl(heroFile.id)
                : null
          }
        />
      </ScrollView>

      {/* Edit sheet */}
      <EditItemSheet
        visible={editVisible}
        onClose={() => setEditVisible(false)}
        item={{
          id: item.id,
          name: item.name,
          description: item.description,
          isPublic: item.isPublic,
          parentId: item.parentId,
        }}
      />

      {/* Create child sheet */}
      <CreateItemSheet
        visible={createVisible}
        onClose={() => setCreateVisible(false)}
        parentId={itemId}
      />

      {/* TMDB search sheet */}
      <TmdbSearchSheet
        visible={tmdbSearchVisible}
        onClose={() => setTmdbSearchVisible(false)}
        onSelect={handleTmdbSelect}
      />

      {/* TMDB confirm sheet */}
      <TmdbConfirmSheet
        visible={tmdbConfirmVisible}
        onClose={() => {
          setTmdbConfirmVisible(false);
          setSelectedTmdbResult(null);
        }}
        onConfirm={handleTmdbConfirm}
        itemId={itemId}
        result={selectedTmdbResult}
      />

      {/* Add to playlist sheet */}
      <AddToPlaylistSheet
        visible={addToPlaylistVisible}
        onClose={() => setAddToPlaylistVisible(false)}
        itemId={itemId}
        onCreatePlaylist={() => {
          setAddToPlaylistVisible(false);
          setCreatePlaylistFromAddVisible(true);
        }}
      />

      {/* Create playlist sheet (launched from add-to-playlist) */}
      <CreatePlaylistSheet
        visible={createPlaylistFromAddVisible}
        onClose={() => setCreatePlaylistFromAddVisible(false)}
        initialItemIds={[itemId]}
      />
    </View>
  );
}
