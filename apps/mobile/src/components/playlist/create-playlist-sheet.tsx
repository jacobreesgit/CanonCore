import { useState } from "react";
import { View, Text, TextInput, Pressable, ScrollView } from "@/tw";
import { Modal, KeyboardAvoidingView, Platform, ActivityIndicator } from "react-native";
import { FontAwesomeIcon } from "@fortawesome/react-native-fontawesome";
import { faXmark, faCheck } from "@fortawesome/free-solid-svg-icons";
import { usePlaylistMutations } from "@/hooks/use-playlist-mutations";

type Visibility = "private" | "unlisted" | "public";

const VISIBILITY_OPTIONS: { value: Visibility; label: string; description: string }[] = [
  { value: "private", label: "Private", description: "Only you can see this" },
  { value: "unlisted", label: "Unlisted", description: "Anyone with the link can see this" },
  { value: "public", label: "Public", description: "Anyone can discover and see this" },
];

interface CreatePlaylistSheetProps {
  visible: boolean;
  onClose: () => void;
  initialItemIds?: string[];
  onCreated?: (playlistId: string) => void;
}

export function CreatePlaylistSheet({
  visible,
  onClose,
  initialItemIds,
  onCreated,
}: CreatePlaylistSheetProps) {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [visibility, setVisibility] = useState<Visibility>("private");
  const [prevVisible, setPrevVisible] = useState(false);

  const { createPlaylist } = usePlaylistMutations();

  // Reset form synchronously when sheet opens
  if (visible && !prevVisible) {
    setPrevVisible(true);
    setName("");
    setDescription("");
    setVisibility("private");
  }
  if (!visible && prevVisible) {
    setPrevVisible(false);
  }

  const handleCreate = () => {
    if (!name.trim()) return;

    createPlaylist.mutate(
      {
        name: name.trim(),
        description: description.trim() || undefined,
        visibility,
        itemIds: initialItemIds ?? [],
      },
      {
        onSuccess: (data) => {
          onCreated?.(data.id);
          onClose();
        },
      }
    );
  };

  const isValid = name.trim().length > 0 && name.trim().length <= 255;

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="formSheet"
      onRequestClose={onClose}
    >
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        className="flex-1 bg-background"
      >
        {/* Header */}
        <View className="flex-row items-center justify-between px-4 py-3 border-b border-border">
          <Pressable onPress={onClose} hitSlop={8}>
            <FontAwesomeIcon icon={faXmark} size={18} color="#ffffff" />
          </Pressable>
          <Text className="text-foreground text-base font-semibold">
            Create Playlist
          </Text>
          <Pressable
            testID="create-playlist-confirm"
            onPress={handleCreate}
            disabled={!isValid || createPlaylist.isPending}
            hitSlop={8}
            style={{ opacity: isValid && !createPlaylist.isPending ? 1 : 0.4 }}
          >
            {createPlaylist.isPending ? (
              <ActivityIndicator size="small" color="#6366f1" />
            ) : (
              <FontAwesomeIcon icon={faCheck} size={18} color="#6366f1" />
            )}
          </Pressable>
        </View>

        <ScrollView
          contentContainerStyle={{ padding: 16, gap: 20 }}
          keyboardShouldPersistTaps="handled"
        >
          {/* Name */}
          <View className="gap-2">
            <Text className="text-foreground text-sm font-medium">Name</Text>
            <TextInput
              testID="playlist-name-input"
              className="bg-card text-foreground rounded-lg px-3 py-3 text-base border border-border"
              value={name}
              onChangeText={setName}
              placeholder="Playlist name"
              placeholderTextColor="rgba(255, 255, 255, 0.3)"
              maxLength={255}
              autoFocus
            />
            <Text className="text-muted-foreground text-xs text-right">
              {name.length}/255
            </Text>
          </View>

          {/* Description */}
          <View className="gap-2">
            <Text className="text-foreground text-sm font-medium">
              Description
            </Text>
            <TextInput
              className="bg-card text-foreground rounded-lg px-3 py-3 text-base border border-border"
              value={description}
              onChangeText={setDescription}
              placeholder="Optional description"
              placeholderTextColor="rgba(255, 255, 255, 0.3)"
              maxLength={1000}
              multiline
              numberOfLines={3}
              style={{ minHeight: 80, textAlignVertical: "top" }}
            />
            <Text className="text-muted-foreground text-xs text-right">
              {description.length}/1000
            </Text>
          </View>

          {/* Visibility */}
          <View className="gap-3">
            <Text className="text-foreground text-sm font-medium">
              Visibility
            </Text>
            {VISIBILITY_OPTIONS.map((option) => (
              <Pressable
                key={option.value}
                onPress={() => setVisibility(option.value)}
                className="flex-row items-center gap-3"
              >
                <View
                  style={{
                    width: 20,
                    height: 20,
                    borderRadius: 10,
                    borderWidth: 2,
                    borderColor:
                      visibility === option.value ? "#6366f1" : "rgba(255,255,255,0.3)",
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  {visibility === option.value && (
                    <View
                      style={{
                        width: 10,
                        height: 10,
                        borderRadius: 5,
                        backgroundColor: "#6366f1",
                      }}
                    />
                  )}
                </View>
                <View className="flex-1">
                  <Text className="text-foreground text-sm">{option.label}</Text>
                  <Text className="text-muted-foreground text-xs">
                    {option.description}
                  </Text>
                </View>
              </Pressable>
            ))}
          </View>

          {/* Error */}
          {createPlaylist.isError ? (
            <Text className="text-red-500 text-sm">
              {createPlaylist.error?.message ?? "Failed to create playlist"}
            </Text>
          ) : null}
        </ScrollView>
      </KeyboardAvoidingView>
    </Modal>
  );
}
