/**
 * No-op subscribe for useSyncExternalStore.
 * Used to detect client vs server rendering (value never changes).
 */
export const emptySubscribe = () => () => {};
