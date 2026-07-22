import { Tabs } from "expo-router";
import { BookOpen, FileText, HeartPulse, Sun, UserRound } from "lucide-react-native";

export default function TabsLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: "#6c4b36",
        tabBarInactiveTintColor: "#8a8580",
        tabBarStyle: { backgroundColor: "#ffffff", borderTopColor: "#e4ddd6" },
        tabBarLabelStyle: { fontFamily: "IBMPlexSans_500Medium", fontSize: 11 },
      }}
    >
      <Tabs.Screen name="today" options={{ title: "Today", tabBarIcon: ({ color, size }) => <Sun color={color} size={size} /> }} />
      <Tabs.Screen name="reports" options={{ title: "Reports", tabBarIcon: ({ color, size }) => <FileText color={color} size={size} /> }} />
      <Tabs.Screen name="health" options={{ title: "Health", tabBarIcon: ({ color, size }) => <HeartPulse color={color} size={size} /> }} />
      <Tabs.Screen name="knowledge" options={{ title: "Knowledge", tabBarIcon: ({ color, size }) => <BookOpen color={color} size={size} /> }} />
      <Tabs.Screen name="profile" options={{ title: "Profile", tabBarIcon: ({ color, size }) => <UserRound color={color} size={size} /> }} />
    </Tabs>
  );
}
