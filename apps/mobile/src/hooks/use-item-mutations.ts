import { useTRPC } from "@/lib/trpc";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { router } from "expo-router";

export function useCreateItem() {
  const trpc = useTRPC();
  const queryClient = useQueryClient();

  return useMutation(
    trpc.item.create.mutationOptions({
      onSuccess: (data) => {
        queryClient.invalidateQueries(trpc.item.list.queryFilter());
        if (data?.id) {
          router.push(`/item/${data.id}`);
        }
      },
    })
  );
}

export function useUpdateItem() {
  const trpc = useTRPC();
  const queryClient = useQueryClient();

  return useMutation(
    trpc.item.update.mutationOptions({
      onSuccess: (_data, variables) => {
        queryClient.invalidateQueries(
          trpc.item.get.queryFilter({ id: variables.id })
        );
        queryClient.invalidateQueries(trpc.item.list.queryFilter());
      },
    })
  );
}

export function useDeleteItem() {
  const trpc = useTRPC();
  const queryClient = useQueryClient();

  return useMutation(
    trpc.item.delete.mutationOptions({
      onSuccess: () => {
        queryClient.invalidateQueries(trpc.item.list.queryFilter());
        router.back();
      },
    })
  );
}

export function useSetVisibility() {
  const trpc = useTRPC();
  const queryClient = useQueryClient();

  return useMutation(
    trpc.item.setVisibility.mutationOptions({
      onSuccess: (_data, variables) => {
        queryClient.invalidateQueries(
          trpc.item.get.queryFilter({ id: variables.id })
        );
      },
    })
  );
}
