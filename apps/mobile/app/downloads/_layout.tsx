import { Stack } from "expo-router";

export default function DownloadsLayout() {
  return (
    <Stack
      screenOptions={{
        headerStyle: { backgroundColor: "#0a0a0a" },
        headerTintColor: "#ffffff",
        headerShadowVisible: false,
        contentStyle: { backgroundColor: "#0a0a0a" },
      }}
    >
      <Stack.Screen name="index" options={{ title: "Downloads" }} />
    </Stack>
  );
}
