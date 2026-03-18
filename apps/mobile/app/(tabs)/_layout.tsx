import { Tabs } from "expo-router";
import { FontAwesomeIcon } from "@fortawesome/react-native-fontawesome";
import {
  faHouse,
  faCompass,
  faTableCellsLarge,
  faUser,
} from "@fortawesome/free-solid-svg-icons";
import type { IconDefinition } from "@fortawesome/fontawesome-svg-core";

const TABS: {
  name: string;
  title: string;
  icon: IconDefinition;
  testID: string;
}[] = [
  { name: "index", title: "Home", icon: faHouse, testID: "tab-home" },
  { name: "explore", title: "Explore", icon: faCompass, testID: "tab-explore" },
  {
    name: "library",
    title: "Library",
    icon: faTableCellsLarge,
    testID: "tab-library",
  },
  { name: "profile", title: "Profile", icon: faUser, testID: "tab-profile" },
];

export default function TabLayout() {
  return (
    <Tabs
      screenOptions={{
        headerStyle: { backgroundColor: "#0a0a0a" },
        headerTintColor: "#ffffff",
        headerShadowVisible: false,
        tabBarStyle: {
          backgroundColor: "#0a0a0a",
          borderTopColor: "rgba(255, 255, 255, 0.1)",
        },
        tabBarActiveTintColor: "#ffffff",
        tabBarInactiveTintColor: "rgba(255, 255, 255, 0.4)",
      }}
    >
      {TABS.map((tab) => (
        <Tabs.Screen
          key={tab.name}
          name={tab.name}
          options={{
            title: tab.title,
            tabBarButtonTestID: tab.testID,
            tabBarIcon: ({ color, size }) => (
              <FontAwesomeIcon icon={tab.icon} size={size} color={color} />
            ),
          }}
        />
      ))}
    </Tabs>
  );
}
