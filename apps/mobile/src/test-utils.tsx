import React from "react";
import { render, type RenderOptions } from "@testing-library/react-native";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Provider as ReduxProvider } from "react-redux";
import { configureStore } from "@reduxjs/toolkit";
import { playbackReducer } from "@canoncore/store";

/**
 * Creates a fresh Redux store for each test.
 */
function createTestStore(preloadedState = {}) {
  return configureStore({
    reducer: {
      playback: playbackReducer,
    },
    preloadedState,
  });
}

interface RenderWithProvidersOptions extends Omit<RenderOptions, "wrapper"> {
  preloadedState?: Record<string, unknown>;
}

/**
 * Wraps the component under test with all required providers:
 * - Redux (playback store)
 * - React Query (fresh client per test)
 *
 * tRPC provider is intentionally excluded — mock tRPC calls at the
 * hook level in component tests instead of wiring a full tRPC client.
 */
export function renderWithProviders(
  ui: React.ReactElement,
  { preloadedState, ...renderOptions }: RenderWithProvidersOptions = {},
) {
  const store = createTestStore(preloadedState);
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false, gcTime: 0 },
      mutations: { retry: false },
    },
  });

  function Wrapper({ children }: { children: React.ReactNode }) {
    return (
      <ReduxProvider store={store}>
        <QueryClientProvider client={queryClient}>
          {children}
        </QueryClientProvider>
      </ReduxProvider>
    );
  }

  return {
    ...render(ui, { wrapper: Wrapper, ...renderOptions }),
    store,
    queryClient,
  };
}

// Re-export everything from RNTL for convenience.
export * from "@testing-library/react-native";
export { renderWithProviders as render };
