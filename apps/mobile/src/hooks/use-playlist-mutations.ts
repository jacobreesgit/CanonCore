import { useTRPC } from "@/lib/trpc";
import { useMutation, useQueryClient } from "@tanstack/react-query";

export function useCreatePlaylist() {
  const trpc = useTRPC();
  const queryClient = useQueryClient();

  return useMutation(
    trpc.playlist.create.mutationOptions({
      onSuccess: () => {
        queryClient.invalidateQueries(trpc.playlist.list.queryFilter());
      },
    }),
  );
}

export function useUpdatePlaylist() {
  const trpc = useTRPC();
  const queryClient = useQueryClient();

  return useMutation(
    trpc.playlist.update.mutationOptions({
      onSuccess: (_data, variables) => {
        queryClient.invalidateQueries(
          trpc.playlist.get.queryFilter({ playlistId: variables.id }),
        );
        queryClient.invalidateQueries(trpc.playlist.list.queryFilter());
      },
    }),
  );
}

export function useDeletePlaylist() {
  const trpc = useTRPC();
  const queryClient = useQueryClient();

  return useMutation(
    trpc.playlist.delete.mutationOptions({
      onSuccess: () => {
        queryClient.invalidateQueries(trpc.playlist.list.queryFilter());
      },
    }),
  );
}

export function useUpdatePlaylistVisibility() {
  const trpc = useTRPC();
  const queryClient = useQueryClient();

  return useMutation(
    trpc.playlist.updateVisibility.mutationOptions({
      onSuccess: (_data, variables) => {
        queryClient.invalidateQueries(
          trpc.playlist.get.queryFilter({ playlistId: variables.id }),
        );
        queryClient.invalidateQueries(trpc.playlist.list.queryFilter());
      },
    }),
  );
}

export function useAddItemsToPlaylist() {
  const trpc = useTRPC();
  const queryClient = useQueryClient();

  return useMutation(
    trpc.playlist.addItems.mutationOptions({
      onSuccess: (_data, variables) => {
        for (const playlistId of variables.playlistIds) {
          queryClient.invalidateQueries(
            trpc.playlist.get.queryFilter({ playlistId }),
          );
        }
        queryClient.invalidateQueries(trpc.playlist.list.queryFilter());
      },
    }),
  );
}

export function useRemoveItemFromPlaylist() {
  const trpc = useTRPC();
  const queryClient = useQueryClient();

  return useMutation(
    trpc.playlist.removeItem.mutationOptions({
      onSuccess: (_data, variables) => {
        queryClient.invalidateQueries(
          trpc.playlist.get.queryFilter({ playlistId: variables.playlistId }),
        );
        queryClient.invalidateQueries(trpc.playlist.list.queryFilter());
      },
    }),
  );
}

/**
 * Composite hook that returns all playlist mutations under a single object.
 * Used by the playlist sheet components.
 */
export function usePlaylistMutations() {
  const trpc = useTRPC();
  const queryClient = useQueryClient();

  const createPlaylist = useMutation(
    trpc.playlist.create.mutationOptions({
      onSuccess: () => {
        queryClient.invalidateQueries(trpc.playlist.list.queryFilter());
      },
    }),
  );

  const updatePlaylist = useMutation(
    trpc.playlist.update.mutationOptions({
      onSuccess: (_data, variables) => {
        queryClient.invalidateQueries(
          trpc.playlist.get.queryFilter({ playlistId: variables.id }),
        );
        queryClient.invalidateQueries(trpc.playlist.list.queryFilter());
      },
    }),
  );

  const updateVisibility = useMutation(
    trpc.playlist.updateVisibility.mutationOptions({
      onSuccess: (_data, variables) => {
        queryClient.invalidateQueries(
          trpc.playlist.get.queryFilter({ playlistId: variables.id }),
        );
        queryClient.invalidateQueries(trpc.playlist.list.queryFilter());
      },
    }),
  );

  const deletePlaylist = useMutation(
    trpc.playlist.delete.mutationOptions({
      onSuccess: () => {
        queryClient.invalidateQueries(trpc.playlist.list.queryFilter());
      },
    }),
  );

  const addItems = useMutation(
    trpc.playlist.addItems.mutationOptions({
      onSuccess: (_data, variables) => {
        queryClient.invalidateQueries(
          trpc.playlist.getForItem.queryFilter({ itemId: variables.itemId }),
        );
        for (const playlistId of variables.playlistIds) {
          queryClient.invalidateQueries(
            trpc.playlist.get.queryFilter({ playlistId }),
          );
        }
        queryClient.invalidateQueries(trpc.playlist.list.queryFilter());
      },
    }),
  );

  const removeItem = useMutation(
    trpc.playlist.removeItem.mutationOptions({
      onSuccess: (_data, variables) => {
        queryClient.invalidateQueries(
          trpc.playlist.getForItem.queryFilter({ itemId: variables.itemId }),
        );
        queryClient.invalidateQueries(
          trpc.playlist.get.queryFilter({ playlistId: variables.playlistId }),
        );
        queryClient.invalidateQueries(trpc.playlist.list.queryFilter());
      },
    }),
  );

  return {
    createPlaylist,
    updatePlaylist,
    updateVisibility,
    deletePlaylist,
    addItems,
    removeItem,
  };
}
