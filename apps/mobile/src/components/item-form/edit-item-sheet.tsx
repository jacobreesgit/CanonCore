import { useState } from "react";
import { View, Text, TextInput, Pressable, ScrollView } from "@/tw";
import { Modal, KeyboardAvoidingView, Switch, Platform } from "react-native";
import { FontAwesomeIcon } from "@fortawesome/react-native-fontawesome";
import { faXmark } from "@fortawesome/free-solid-svg-icons";
import { useUpdateItem, useSetVisibility } from "@/hooks/use-item-mutations";

interface EditItemSheetProps {
  visible: boolean;
  onClose: () => void;
  item: {
    id: string;
    name: string;
    description: string | null;
    isPublic: boolean;
    parentId: string | null;
  };
}

export function EditItemSheet({
  visible,
  onClose,
  item,
}: EditItemSheetProps) {
  const [name, setName] = useState(item.name);
  const [description, setDescription] = useState(item.description ?? "");
  const [isPublic, setIsPublic] = useState(item.isPublic);
  const [prevVisible, setPrevVisible] = useState(false);

  const updateItem = useUpdateItem();
  const setVisibility = useSetVisibility();

  // Reset form synchronously when sheet opens
  if (visible && !prevVisible) {
    setPrevVisible(true);
    setName(item.name);
    setDescription(item.description ?? "");
    setIsPublic(item.isPublic);
  }
  if (!visible && prevVisible) {
    setPrevVisible(false);
  }

  const handleSave = async () => {
    if (!name.trim()) return;

    const nameChanged = name.trim() !== item.name;
    const descChanged = description.trim() !== (item.description ?? "");
    const visibilityChanged = isPublic !== item.isPublic;

    if (nameChanged || descChanged) {
      await updateItem.mutateAsync({
        id: item.id,
        name: nameChanged ? name.trim() : undefined,
        description: descChanged ? description.trim() : undefined,
      });
    }

    if (visibilityChanged) {
      await setVisibility.mutateAsync({
        id: item.id,
        isPublic,
      });
    }

    onClose();
  };

  const isDirty =
    name.trim() !== item.name ||
    description.trim() !== (item.description ?? "") ||
    isPublic !== item.isPublic;

  const isValid = name.trim().length > 0 && name.trim().length <= 255;
  const isPending = updateItem.isPending || setVisibility.isPending;

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
            Edit Item
          </Text>
          <Pressable
            onPress={handleSave}
            disabled={!isValid || !isDirty || isPending}
            style={{ opacity: isValid && isDirty && !isPending ? 1 : 0.4 }}
          >
            <Text className="text-primary text-base font-semibold">Save</Text>
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
          </View>

          {/* Error */}
          {updateItem.isError || setVisibility.isError ? (
            <Text className="text-red-500 text-sm">
              {updateItem.error?.message ??
                setVisibility.error?.message ??
                "Failed to save"}
            </Text>
          ) : null}
        </ScrollView>
      </KeyboardAvoidingView>
    </Modal>
  );
}
