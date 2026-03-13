import { useState } from "react";
import { View, Text, TextInput, Pressable, ScrollView } from "@/tw";
import {
  Modal,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  Alert,
} from "react-native";
import { FontAwesomeIcon } from "@fortawesome/react-native-fontawesome";
import { faXmark, faCheck } from "@fortawesome/free-solid-svg-icons";
import { usePlaylistMutations } from "@/hooks/use-playlist-mutations";

type Visibility = "private" | "unlisted" | "public";

const VISIBILITY_OPTIONS: { value: Visibility; label: string; description: string }[] = [
  { value: "private", label: "Private", description: "Only you can see this" },
  { value: "unlisted", label: "Unlisted", description: "Anyone with the link can see this" },
  { value: "public", label: "Public", description: "Anyone can discover and see this" },
];

function deriveVisibility(isPublic: boolean, shareToken: string | null): Visibility {
  if (isPublic) return "public";
  if (shareToken) return "unlisted";
  return "private";
}

interface EditPlaylistSheetProps {
  visible: boolean;
  onClose: () => void;
  playlist: {
    id: string;
    name: string;
    description: string | null;
    isPublic: boolean;
    shareToken: string | null;
  };
  onUpdated?: () => void;
  onDeleted?: () => void;
}

export function EditPlaylistSheet({
  visible,
  onClose,
  playlist,
  onUpdated,
  onDeleted,
}: EditPlaylistSheetProps) {
  const initialVisibility = deriveVisibility(playlist.isPublic, playlist.shareToken);

  const [name, setName] = useState(playlist.name);
  const [description, setDescription] = useState(playlist.description ?? "");
  const [visibility, setVisibility] = useState<Visibility>(initialVisibility);
  const [prevVisible, setPrevVisible] = useState(false);

  const { updatePlaylist, updateVisibility, deletePlaylist } = usePlaylistMutations();

  // Reset form synchronously when sheet opens
  if (visible && !prevVisible) {
    setPrevVisible(true);
    setName(playlist.name);
    setDescription(playlist.description ?? "");
    setVisibility(deriveVisibility(playlist.isPublic, playlist.shareToken));
  }
  if (!visible && prevVisible) {
    setPrevVisible(false);
  }

  const handleSave = async () => {
    if (!name.trim()) return;

    const nameChanged = name.trim() !== playlist.name;
    const descChanged = description.trim() !== (playlist.description ?? "");
    const visibilityChanged =
      visibility !== deriveVisibility(playlist.isPublic, playlist.shareToken);

    if (nameChanged || descChanged) {
      await updatePlaylist.mutateAsync({
        id: playlist.id,
        name: nameChanged ? name.trim() : undefined,
        description: descChanged ? description.trim() : undefined,
      });
    }

    if (visibilityChanged) {
      await updateVisibility.mutateAsync({
        id: playlist.id,
        visibility,
      });
    }

    onUpdated?.();
    onClose();
  };

  const handleDelete = () => {
    Alert.alert(
      "Delete Playlist",
      `Are you sure you want to delete "${playlist.name}"? This cannot be undone.`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: () => {
            deletePlaylist.mutate(
              { id: playlist.id },
              {
                onSuccess: () => {
                  onDeleted?.();
                  onClose();
                },
              }
            );
          },
        },
      ]
    );
  };

  const isDirty =
    name.trim() !== playlist.name ||
    description.trim() !== (playlist.description ?? "") ||
    visibility !== deriveVisibility(playlist.isPublic, playlist.shareToken);

  const isValid = name.trim().length > 0 && name.trim().length <= 255;
  const isPending =
    updatePlaylist.isPending || updateVisibility.isPending || deletePlaylist.isPending;

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
            Edit Playlist
          </Text>
          <Pressable
            onPress={handleSave}
            disabled={!isValid || !isDirty || isPending}
            hitSlop={8}
            style={{ opacity: isValid && isDirty && !isPending ? 1 : 0.4 }}
          >
            {isPending ? (
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
              className="bg-card text-foreground rounded-lg px-3 py-3 text-base border border-border"
              value={name}
              onChangeText={setName}
              placeholder="Playlist name"
              placeholderTextColor="rgba(255, 255, 255, 0.3)"
              maxLength={255}
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

          {/* Errors */}
          {(updatePlaylist.isError || updateVisibility.isError) ? (
            <Text className="text-red-500 text-sm">
              {updatePlaylist.error?.message ??
                updateVisibility.error?.message ??
                "Failed to save"}
            </Text>
          ) : null}

          {/* Delete */}
          <View className="mt-4 pt-4 border-t border-border">
            <Pressable
              onPress={handleDelete}
              disabled={deletePlaylist.isPending}
              className="items-center py-3 rounded-lg bg-red-950"
              style={{ opacity: deletePlaylist.isPending ? 0.5 : 1 }}
            >
              <Text className="text-red-400 text-sm font-semibold">
                Delete Playlist
              </Text>
            </Pressable>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </Modal>
  );
}
