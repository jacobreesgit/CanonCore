import "../src/global.css";

import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import * as SplashScreen from "expo-splash-screen";
import { useEffect } from "react";
import { Providers } from "@/components/providers";
import { useSession } from "@/ctx";

// Prevent splash screen from hiding until auth state loads
SplashScreen.preventAutoHideAsync();

function RootNavigator() {
  const { isLoading, token } = useSession();

  useEffect(() => {
    if (!isLoading) {
      SplashScreen.hideAsync();
    }
  }, [isLoading]);

  if (isLoading) {
    return null;
  }

  return (
    <Stack
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: "#0a0a0a" },
        animation: "fade",
      }}
    >
      <Stack.Protected guard={!!token}>
        <Stack.Screen name="(tabs)" />
        <Stack.Screen name="library" options={{ headerShown: false }} />
        <Stack.Screen name="item/[itemId]" />
        <Stack.Screen name="playlist/[playlistId]" />
        <Stack.Screen
          name="player"
          options={{ presentation: "modal" }}
        />
      </Stack.Protected>
      <Stack.Protected guard={!token}>
        <Stack.Screen name="(auth)" />
      </Stack.Protected>
      {/* Public routes — accessible regardless of auth */}
      <Stack.Screen name="u/[username]" />
    </Stack>
  );
}

export default function RootLayout() {
  return (
    <Providers>
      <StatusBar style="light" />
      <RootNavigator />
    </Providers>
  );
}
