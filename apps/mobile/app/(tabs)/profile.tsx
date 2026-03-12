import { Text, ScrollView, Pressable } from "@/tw";
import { useSession } from "@/ctx";

export default function ProfileScreen() {
  const { user, signOut } = useSession();

  return (
    <ScrollView
      className="flex-1 bg-background"
      contentContainerClassName="p-5 gap-4"
      contentInsetAdjustmentBehavior="automatic"
    >
      <Text className="text-2xl font-bold text-foreground">Profile</Text>
      <Text className="text-muted-foreground">
        Signed in as {user?.email ?? "unknown"}
      </Text>
      <Pressable
        className="bg-destructive rounded-lg p-3 items-center mt-4"
        onPress={signOut}
        style={{ borderCurve: "continuous" }}
      >
        <Text className="text-white font-semibold">Sign Out</Text>
      </Pressable>
    </ScrollView>
  );
}
