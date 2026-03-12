import { Stack } from "expo-router";

export default function PublicProfileLayout() {
  return (
    <Stack
      screenOptions={{
        headerStyle: { backgroundColor: "#0a0a0a" },
        headerTintColor: "#ffffff",
        headerShadowVisible: false,
        contentStyle: { backgroundColor: "#0a0a0a" },
      }}
    />
  );
}
