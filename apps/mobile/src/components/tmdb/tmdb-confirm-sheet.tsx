import { View, Text, Pressable, ScrollView } from "@/tw";
import { Modal, ActivityIndicator } from "react-native";
import { Image } from "@/tw/image";
import { FontAwesomeIcon } from "@fortawesome/react-native-fontawesome";
import { faXmark, faCheck } from "@fortawesome/free-solid-svg-icons";
import { useTRPC } from "@/lib/trpc";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { getTmdbPosterUrl } from "@/lib/image-url";
import { useEffect } from "react";
import type { TmdbResult } from "./tmdb-search-sheet";

interface TmdbConfirmSheetProps {
  visible: boolean;
  onClose: () => void;
  onConfirm: () => void;
  itemId: string;
  result: TmdbResult | null;
}

export function TmdbConfirmSheet({
  visible,
  onClose,
  onConfirm,
  itemId,
  result,
}: TmdbConfirmSheetProps) {
  const trpc = useTRPC();
  const queryClient = useQueryClient();

  // tmdb.getPreview is a mutation — fetch preview data when sheet opens
  const previewMutation = useMutation(
    trpc.tmdb.getPreview.mutationOptions()
  );

  useEffect(() => {
    if (visible && result) {
      previewMutation.mutate({
        tmdbId: result.id,
        mediaType: result.mediaType,
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible, result?.id]);

  const applyMetadata = useMutation(
    trpc.tmdb.applyMetadata.mutationOptions({
      onSuccess: () => {
        queryClient.invalidateQueries(
          trpc.item.get.queryFilter({ id: itemId })
        );
        onConfirm();
      },
    })
  );

  const handleConfirm = () => {
    if (!result) return;
    applyMetadata.mutate({
      itemId,
      tmdbId: result.id,
      mediaType: result.mediaType,
    });
  };

  if (!result) return null;

  const preview = previewMutation.data;

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="formSheet"
      onRequestClose={onClose}
    >
      <View className="flex-1 bg-background">
        {/* Header */}
        <View className="flex-row items-center justify-between px-4 py-3 border-b border-border">
          <Pressable onPress={onClose}>
            <FontAwesomeIcon icon={faXmark} size={18} color="#ffffff" />
          </Pressable>
          <Text className="text-foreground text-base font-semibold">
            Apply Metadata
          </Text>
          <Pressable
            onPress={handleConfirm}
            disabled={applyMetadata.isPending}
            style={{ opacity: applyMetadata.isPending ? 0.4 : 1 }}
          >
            <FontAwesomeIcon icon={faCheck} size={18} color="#6366f1" />
          </Pressable>
        </View>

        {previewMutation.isPending ? (
          <View className="items-center justify-center flex-1">
            <ActivityIndicator color="#ffffff" />
          </View>
        ) : (
          <ScrollView
            contentContainerStyle={{ padding: 16, gap: 16 }}
            showsVerticalScrollIndicator={false}
          >
            {/* Poster + Title */}
            <View className="flex-row gap-4">
              {result.posterPath ? (
                <Image
                  source={getTmdbPosterUrl(result.posterPath, "w342")}
                  className="rounded-lg bg-card"
                  style={{ width: 100, height: 150 }}
                  transition={300}
                />
              ) : null}
              <View className="flex-1 gap-2 justify-center">
                <Text className="text-foreground text-lg font-bold">
                  {result.title}
                </Text>
                <View className="flex-row gap-2">
                  {result.year ? (
                    <Text className="text-muted-foreground text-sm">
                      {result.year}
                    </Text>
                  ) : null}
                  <Text className="text-muted-foreground text-sm uppercase">
                    {result.mediaType === "movie" ? "Movie" : "TV Show"}
                  </Text>
                </View>
                {preview?.description ? (
                  <Text className="text-muted-foreground text-sm italic">
                    {preview.description.slice(0, 120)}
                    {preview.description.length > 120 ? "…" : ""}
                  </Text>
                ) : null}
              </View>
            </View>

            {/* Overview */}
            {result.overview ? (
              <View className="gap-2">
                <Text className="text-foreground text-sm font-semibold">
                  Overview
                </Text>
                <Text
                  className="text-muted-foreground text-sm leading-relaxed"
                  selectable
                >
                  {result.overview}
                </Text>
              </View>
            ) : null}

            {/* Confirmation note */}
            <View className="bg-card rounded-lg p-4 border border-border">
              <Text className="text-muted-foreground text-sm">
                This will apply TMDB metadata (title, description, poster,
                backdrop) to your item. You can customise display options
                afterwards.
              </Text>
            </View>

            {/* Error */}
            {applyMetadata.isError ? (
              <Text className="text-red-500 text-sm">
                {applyMetadata.error?.message ?? "Failed to apply metadata"}
              </Text>
            ) : null}
          </ScrollView>
        )}
      </View>
    </Modal>
  );
}
