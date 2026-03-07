import { describe, it, expect, vi } from "vitest";
import { renderHook } from "@testing-library/react";
import { useInfiniteItems } from "@/hooks/use-infinite-items";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

const createWrapper = () => {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false, staleTime: Infinity },
    },
  });
  function Wrapper({ children }: { children: React.ReactNode }) {
    return (
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    );
  }
  return Wrapper;
};

describe("useInfiniteItems", () => {
  it("seeds initial data without fetching", () => {
    const fetchAction = vi.fn();
    const initialItems = [{ id: "1", name: "Item 1" }];

    const { result } = renderHook(
      () =>
        useInfiniteItems({
          queryKey: ["test"],
          fetchAction,
          initialData: { items: initialItems, nextCursor: null },
        }),
      { wrapper: createWrapper() }
    );

    expect(result.current.items).toEqual(initialItems);
    expect(fetchAction).not.toHaveBeenCalled();
  });

  it("reports hasNextPage from initial data", () => {
    const fetchAction = vi.fn();
    const { result } = renderHook(
      () =>
        useInfiniteItems({
          queryKey: ["test-has-more"],
          fetchAction,
          initialData: { items: [{ id: "1" }], nextCursor: "abc" },
        }),
      { wrapper: createWrapper() }
    );

    expect(result.current.hasNextPage).toBe(true);
  });

  it("reports no next page when nextCursor is null", () => {
    const fetchAction = vi.fn();
    const { result } = renderHook(
      () =>
        useInfiniteItems({
          queryKey: ["test-no-more"],
          fetchAction,
          initialData: { items: [{ id: "1" }], nextCursor: null },
        }),
      { wrapper: createWrapper() }
    );

    expect(result.current.hasNextPage).toBe(false);
  });

  it("handles fetch error gracefully", async () => {
    const fetchAction = vi.fn().mockRejectedValue(new Error("Network error"));

    const { result } = renderHook(
      () =>
        useInfiniteItems({
          queryKey: ["test-error"],
          fetchAction,
          initialData: { items: [{ id: "1" }], nextCursor: "abc" },
        }),
      { wrapper: createWrapper() }
    );

    // Initial data should still be available
    expect(result.current.items).toHaveLength(1);
  });
});
