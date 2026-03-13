import { Text, ScrollView, Pressable } from "@/tw";
import { useSession } from "@/ctx";
import { router } from "expo-router";
import { FontAwesomeIcon } from "@fortawesome/react-native-fontawesome";
import { faDownload, faChevronRight } from "@fortawesome/free-solid-svg-icons";

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

      {/* Downloads */}
      <Pressable
        className="flex-row items-center gap-3 bg-white/5 rounded-lg p-4 mt-2"
        onPress={() => router.push("/downloads")}
        style={{ borderCurve: "continuous" }}
      >
        <FontAwesomeIcon icon={faDownload} size={18} color="#ffffff" />
        <Text className="text-white font-medium flex-1">Downloads</Text>
        <FontAwesomeIcon
          icon={faChevronRight}
          size={12}
          color="rgba(255, 255, 255, 0.4)"
        />
      </Pressable>

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
