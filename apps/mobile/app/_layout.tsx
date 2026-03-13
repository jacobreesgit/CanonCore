import "../src/global.css";

import { View } from "react-native";
import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import * as SplashScreen from "expo-splash-screen";
import { useEffect } from "react";
import { Providers } from "@/components/providers";
import { PlaybackProvider } from "@/components/providers/playback-provider";
import { useSession } from "@/ctx";
import { MiniPlayer } from "@/components/media/mini-player";
import { useAppSelector } from "@canoncore/store/hooks";
import { selectCurrentTrack } from "@canoncore/store/selectors";

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
        <Stack.Screen name="item" options={{ headerShown: false }} />
        <Stack.Screen name="playlist" options={{ headerShown: false }} />
        <Stack.Screen name="downloads" options={{ headerShown: false }} />
        <Stack.Screen
          name="player"
          options={{
            presentation: "modal",
            headerShown: false,
            contentStyle: { backgroundColor: "#0a0a0a" },
          }}
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

function RootContent() {
  const currentTrack = useAppSelector(selectCurrentTrack);

  return (
    <PlaybackProvider>
      <View style={{ flex: 1 }}>
        <StatusBar style="light" />
        <RootNavigator />
        {currentTrack ? (
          <View
            style={{
              position: "absolute",
              bottom: 49,
              left: 0,
              right: 0,
            }}
          >
            <MiniPlayer />
          </View>
        ) : null}
      </View>
    </PlaybackProvider>
  );
}

export default function RootLayout() {
  return (
    <Providers>
      <RootContent />
    </Providers>
  );
}
