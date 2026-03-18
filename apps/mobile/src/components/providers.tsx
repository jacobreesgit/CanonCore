import React from "react";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { Provider as ReduxProvider } from "react-redux";
import { PersistGate } from "redux-persist/integration/react";
import { store, persistor } from "@/lib/store";
import { TRPCReactProvider } from "@/lib/trpc";
import { SessionProvider } from "@/ctx";
import { DatabaseProvider } from "./providers/database-provider";
import { DownloadManagerProvider } from "./providers/download-manager-provider";

/**
 * All app-level providers combined.
 * Order: GestureHandler → SafeArea → Redux → Auth → tRPC → Database → DownloadManager
 */
export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <ReduxProvider store={store}>
          <PersistGate loading={null} persistor={persistor}>
            <SessionProvider>
              <TRPCReactProvider>
                <DatabaseProvider>
                  <DownloadManagerProvider>{children}</DownloadManagerProvider>
                </DatabaseProvider>
              </TRPCReactProvider>
            </SessionProvider>
          </PersistGate>
        </ReduxProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
