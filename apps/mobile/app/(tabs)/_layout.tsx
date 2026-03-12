import { Tabs } from "expo-router";
import { FontAwesomeIcon } from "@fortawesome/react-native-fontawesome";
import { faHouse, faCompass, faTableCellsLarge, faUser } from "@fortawesome/free-solid-svg-icons";

export default function TabLayout() {
  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: "#ffffff",
        tabBarInactiveTintColor: "rgba(255, 255, 255, 0.4)",
        tabBarStyle: {
          backgroundColor: "#0a0a0a",
          borderTopColor: "rgba(255, 255, 255, 0.1)",
        },
        headerStyle: {
          backgroundColor: "#0a0a0a",
        },
        headerTintColor: "#ffffff",
        headerShadowVisible: false,
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: "Home",
          tabBarIcon: ({ color, size }) => (
            <FontAwesomeIcon icon={faHouse} size={size} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="explore"
        options={{
          title: "Explore",
          tabBarIcon: ({ color, size }) => (
            <FontAwesomeIcon icon={faCompass} size={size} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="library"
        options={{
          title: "Library",
          tabBarIcon: ({ color, size }) => (
            <FontAwesomeIcon icon={faTableCellsLarge} size={size} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: "Profile",
          tabBarIcon: ({ color, size }) => (
            <FontAwesomeIcon icon={faUser} size={size} color={color} />
          ),
        }}
      />
    </Tabs>
  );
}
