import type { UseQueryResult } from "@tanstack/react-query";
import React from "react";

import { errorDetail, isNetworkError, isPlanGated } from "@/lib/api-client";
import { ErrorText, Loading, PlanGateCard } from "./ui";

/** Same shape as the dashboard's QueryBoundary: loading → 402 → error → data.
 *  Raw backend error strings (e.g. a literal "Not Found") are never shown
 *  directly to the user -- genuinely unexpected failures get one calm,
 *  actionable message instead.
 *
 * Network errors specifically are handled differently: the app-wide
 * OfflineBanner (mounted once in app/(app)/_layout.tsx) already
 * communicates "you're offline" -- individual QueryBoundary instances no
 * longer ALSO render their own copy of that same message, which
 * previously stacked up once per failed query on a screen with several
 * (e.g. Today's status + shift queries both failing at once showed the
 * identical sentence twice). If there's still cached data from before the
 * connection dropped, that's shown as-is rather than blocking the screen.
 */
export function QueryBoundary<T>({ query, children }: {
  query: UseQueryResult<T>; children: (data: T) => React.ReactNode;
}) {
  if (query.isPending) return <Loading />;
  if (query.isError) {
    if (isPlanGated(query.error)) return <PlanGateCard detail={query.error.detail} />;

    if (isNetworkError(query.error)) {
      if (query.data !== undefined) return <>{children(query.data)}</>;
      return <Loading />; // OfflineBanner already says what's wrong; just wait quietly
    }

    const detail = errorDetail(query.error);
    const friendly = !detail || detail.toLowerCase() === "not found"
      ? "Couldn't load this right now. Pull down to try again."
      : detail;
    return <ErrorText>{friendly}</ErrorText>;
  }
  return <>{children(query.data)}</>;
}