import { useState } from "react";
import { Redirect } from "expo-router";

import { useAuth } from "@/lib/auth";
import { ConnectionErrorScreen } from "@/components/connection-error-screen";
import { Loading, Screen } from "@/components/ui";

/** Route gate: unauthenticated → login; connectivity failure with NO
 *  known session → retry screen (NOT login -- a lost signal is not the
 *  same thing as being logged out); first run → consent; else the app.
 *
 * Order matters: `me` is checked BEFORE `connectionError`. If a session
 * was already resolved once (me is set) and connectivity drops LATER
 * (e.g. a foreground re-check fails), that's not a reason to block entry
 * here -- the person is already past this gate, sitting inside the app,
 * where OfflineBanner + QueryBoundary's cached-data fallback already
 * handle that gracefully. This screen's retry state is only for the case
 * where a session has genuinely never been established this launch AND
 * the reason is connectivity, not rejection. */
export default function Index() {
  const { ready, me, onboarded, connectionError, retryConnection } = useAuth();
  const [retrying, setRetrying] = useState(false);

  if (!ready) return <Screen scroll={false}><Loading /></Screen>;

  if (!me && connectionError) {
    return (
      <ConnectionErrorScreen
        retrying={retrying}
        onRetry={async () => {
          setRetrying(true);
          await retryConnection();
          setRetrying(false);
        }}
      />
    );
  }

  if (!me) return <Redirect href="/(auth)/login" />;
  if (!onboarded) return <Redirect href="/(onboarding)/consent" />;
  return <Redirect href="/(app)/(tabs)/today" />;
}