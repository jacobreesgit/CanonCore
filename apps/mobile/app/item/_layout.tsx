import { Stack } from "expo-router/stack";

export default function ItemDetailLayout() {
  return (
    <Stack
      screenOptions={{
        headerStyle: { backgroundColor: "#0a0a0a" },
        headerTintColor: "#ffffff",
        headerShadowVisible: false,
        contentStyle: { backgroundColor: "#0a0a0a" },
        headerTransparent: true,
        headerBackButtonDisplayMode: "minimal",
      }}
    />
  );
}
