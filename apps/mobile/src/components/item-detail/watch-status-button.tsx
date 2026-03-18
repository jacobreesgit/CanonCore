import { Pressable, Text } from "@/tw";
import { FontAwesomeIcon } from "@fortawesome/react-native-fontawesome";
import { faEye, faEyeSlash } from "@fortawesome/free-solid-svg-icons";
import { useTRPC } from "@/lib/trpc";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";

interface WatchStatusButtonProps {
  itemId: string;
  initialIsWatched: boolean;
}

export function WatchStatusButton({
  itemId,
  initialIsWatched,
}: WatchStatusButtonProps) {
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const [isWatched, setIsWatched] = useState(initialIsWatched);

  const markWatched = useMutation(
    trpc.watch.markWatched.mutationOptions({
      onMutate: () => setIsWatched(true),
      onError: () => setIsWatched(false),
      onSettled: () => {
        queryClient.invalidateQueries(
          trpc.watch.getStatus.queryFilter({ itemId }),
        );
      },
    }),
  );

  const markUnwatched = useMutation(
    trpc.watch.markUnwatched.mutationOptions({
      onMutate: () => setIsWatched(false),
      onError: () => setIsWatched(true),
      onSettled: () => {
        queryClient.invalidateQueries(
          trpc.watch.getStatus.queryFilter({ itemId }),
        );
      },
    }),
  );

  const isPending = markWatched.isPending || markUnwatched.isPending;

  const handlePress = () => {
    if (isPending) return;
    if (isWatched) {
      markUnwatched.mutate({ itemId });
    } else {
      markWatched.mutate({ itemId });
    }
  };

  return (
    <Pressable
      onPress={handlePress}
      disabled={isPending}
      className="flex-row items-center gap-2 bg-white/10 rounded-lg px-4 py-2.5"
      style={{ opacity: isPending ? 0.5 : 1 }}
    >
      <FontAwesomeIcon
        icon={isWatched ? faEye : faEyeSlash}
        size={14}
        color={isWatched ? "#22c55e" : "rgba(255, 255, 255, 0.6)"}
      />
      <Text className="text-foreground text-sm font-medium">
        {isWatched ? "Watched" : "Unwatched"}
      </Text>
    </Pressable>
  );
}
