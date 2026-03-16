import { Alert, Modal } from "react-native";
import { Pressable, Text, View } from "@/tw";
import { FontAwesomeIcon } from "@fortawesome/react-native-fontawesome";
import {
  faEllipsis,
  faPen,
  faPlus,
  faTrash,
  faFilm,
  faEye,
  faEyeSlash,
  faListUl,
} from "@fortawesome/free-solid-svg-icons";
import { useState } from "react";
import { useTRPC } from "@/lib/trpc";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { router } from "expo-router";

interface ItemActionsMenuProps {
  itemId: string;
  itemName: string;
  isWatched: boolean;
  hasChildren: boolean;
  onEdit: () => void;
  onAddChild: () => void;
  onAddToPlaylist: () => void;
  onTmdb: () => void;
}

export function ItemActionsMenu({
  itemId,
  itemName,
  isWatched,
  hasChildren,
  onEdit,
  onAddChild,
  onAddToPlaylist,
  onTmdb,
}: ItemActionsMenuProps) {
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const [menuVisible, setMenuVisible] = useState(false);

  const deleteItem = useMutation(
    trpc.item.delete.mutationOptions({
      onSuccess: () => {
        queryClient.invalidateQueries(trpc.item.list.queryFilter());
        router.back();
      },
    })
  );

  const markWatched = useMutation(
    trpc.watch.markWatched.mutationOptions({
      onSettled: () => {
        queryClient.invalidateQueries(
          trpc.watch.getStatus.queryFilter({ itemId })
        );
      },
    })
  );

  const markUnwatched = useMutation(
    trpc.watch.markUnwatched.mutationOptions({
      onSettled: () => {
        queryClient.invalidateQueries(
          trpc.watch.getStatus.queryFilter({ itemId })
        );
      },
    })
  );

  const handleDelete = () => {
    setMenuVisible(false);
    Alert.alert(
      "Delete Item",
      `Are you sure you want to delete "${itemName}"?${hasChildren ? " This will also delete all child items." : ""}`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: () => deleteItem.mutate({ id: itemId }),
        },
      ]
    );
  };

  const actions = [
    { icon: faPen, label: "Edit Item", onPress: onEdit },
    { icon: faPlus, label: "Add Child", onPress: onAddChild },
    { icon: faListUl, label: "Add to Playlist", onPress: onAddToPlaylist },
    { icon: faFilm, label: "TMDB Metadata", onPress: onTmdb },
    {
      icon: isWatched ? faEyeSlash : faEye,
      label: isWatched ? "Mark Unwatched" : "Mark Watched",
      onPress: () => {
        if (isWatched) markUnwatched.mutate({ itemId });
        else markWatched.mutate({ itemId });
        setMenuVisible(false);
      },
    },
    {
      icon: faTrash,
      label: "Delete",
      onPress: handleDelete,
      destructive: true,
    },
  ];

  return (
    <>
      <Pressable
        testID="item-settings-button"
        onPress={() => setMenuVisible(true)}
        className="bg-white/10 rounded-lg p-2.5"
      >
        <FontAwesomeIcon icon={faEllipsis} size={16} color="#ffffff" />
      </Pressable>

      <Modal
        visible={menuVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setMenuVisible(false)}
      >
        <Pressable
          style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.5)" }}
          onPress={() => setMenuVisible(false)}
        >
          <View
            className="absolute right-4 bottom-16 bg-card rounded-xl overflow-hidden border border-border min-w-[200px]"
            style={{ borderCurve: "continuous" }}
          >
            {actions.map((action) => (
              <Pressable
                key={action.label}
                onPress={() => {
                  setMenuVisible(false);
                  action.onPress();
                }}
                className="flex-row items-center gap-3 px-4 py-3 active:bg-white/5"
              >
                <FontAwesomeIcon
                  icon={action.icon}
                  size={14}
                  color={
                    action.destructive
                      ? "#ef4444"
                      : "rgba(255, 255, 255, 0.7)"
                  }
                />
                <Text
                  className={`text-sm font-medium ${
                    action.destructive ? "text-red-500" : "text-foreground"
                  }`}
                >
                  {action.label}
                </Text>
              </Pressable>
            ))}
          </View>
        </Pressable>
      </Modal>
    </>
  );
}
