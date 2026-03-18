import { useState } from "react";
import { View, Text, TextInput, Pressable, ScrollView } from "@/tw";
import { Modal, KeyboardAvoidingView, Switch, Platform } from "react-native";
import { FontAwesomeIcon } from "@fortawesome/react-native-fontawesome";
import { faXmark } from "@fortawesome/free-solid-svg-icons";
import { useCreateItem } from "@/hooks/use-item-mutations";

interface CreateItemSheetProps {
  visible: boolean;
  onClose: () => void;
  parentId: string | null;
}

export function CreateItemSheet({
  visible,
  onClose,
  parentId,
}: CreateItemSheetProps) {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [isPublic, setIsPublic] = useState(false);
  const [inheritVisibility, setInheritVisibility] = useState(parentId !== null);

  const createItem = useCreateItem();

  const handleCreate = () => {
    if (!name.trim()) return;

    createItem.mutate(
      {
        name: name.trim(),
        parentId,
        description: description.trim() || undefined,
        options: {
          isPublic,
          inheritVisibility,
        },
      },
      {
        onSuccess: () => {
          setName("");
          setDescription("");
          setIsPublic(false);
          setInheritVisibility(parentId !== null);
          onClose();
        },
      },
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
          <Pressable onPress={onClose}>
            <FontAwesomeIcon icon={faXmark} size={18} color="#ffffff" />
          </Pressable>
          <Text className="text-foreground text-base font-semibold">
            New Item
          </Text>
          <Pressable
            onPress={handleCreate}
            disabled={!isValid || createItem.isPending}
            style={{ opacity: isValid && !createItem.isPending ? 1 : 0.4 }}
          >
            <Text className="text-primary text-base font-semibold">Create</Text>
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
              placeholder="Item name"
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
          <View className="gap-4">
            <Text className="text-foreground text-sm font-medium">
              Visibility
            </Text>
            <View className="flex-row items-center justify-between">
              <Text className="text-foreground text-sm">Make public</Text>
              <Switch
                value={isPublic}
                onValueChange={setIsPublic}
                trackColor={{ true: "#6366f1" }}
              />
            </View>
            {parentId ? (
              <View className="flex-row items-center justify-between">
                <Text className="text-foreground text-sm">
                  Inherit from parent
                </Text>
                <Switch
                  value={inheritVisibility}
                  onValueChange={setInheritVisibility}
                  trackColor={{ true: "#6366f1" }}
                />
              </View>
            ) : null}
          </View>

          {/* Error */}
          {createItem.isError ? (
            <Text className="text-red-500 text-sm">
              {createItem.error?.message ?? "Failed to create item"}
            </Text>
          ) : null}
        </ScrollView>
      </KeyboardAvoidingView>
    </Modal>
  );
}
