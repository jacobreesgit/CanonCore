import { useTRPC } from "@/lib/trpc";
import { useMutation, useQueryClient } from "@tanstack/react-query";

export function useFork() {
  const trpc = useTRPC();
  const queryClient = useQueryClient();

  return useMutation(
    trpc.fork.fork.mutationOptions({
      onSuccess: () => {
        queryClient.invalidateQueries(trpc.item.list.queryFilter());
      },
    }),
  );
}
