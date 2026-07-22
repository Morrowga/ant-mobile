import { Redirect } from "expo-router";

import { useAuth } from "@/lib/auth";
import { Loading, Screen } from "@/components/ui";

/** Route gate: unauthenticated → login; first run → consent; else the app. */
export default function Index() {
  const { ready, me, onboarded } = useAuth();
  if (!ready) return <Screen scroll={false}><Loading /></Screen>;
  if (!me) return <Redirect href="/(auth)/login" />;
  if (!onboarded) return <Redirect href="/(onboarding)/consent" />;
  return <Redirect href="/(app)/(tabs)/today" />;
}
