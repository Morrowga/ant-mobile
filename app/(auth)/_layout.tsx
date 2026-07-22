import { Redirect, Stack } from "expo-router";

import { useAuth } from "@/lib/auth";

export default function AuthLayout() {
  const { me, ready } = useAuth();
  if (ready && me) return <Redirect href="/" />; // already signed in — bounce
  return <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: "#6c4b36" } }} />;
}
