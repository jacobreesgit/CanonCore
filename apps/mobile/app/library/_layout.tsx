import { Stack } from "expo-router/stack";

export default function LibraryDrillDownLayout() {
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
