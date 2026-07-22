import type { UseQueryResult } from "@tanstack/react-query";
import React from "react";

import { errorDetail, isPlanGated } from "@/lib/api-client";
import { ErrorText, Loading, PlanGateCard } from "./ui";

/** Same shape as the dashboard's QueryBoundary: loading → 402 → error → data.
 *  Raw backend error strings (e.g. a literal "Not Found") are never shown
 *  directly to the user -- genuinely unexpected failures get one calm,
 *  actionable message instead. */
export function QueryBoundary<T>({ query, children }: {
  query: UseQueryResult<T>; children: (data: T) => React.ReactNode;
}) {
  if (query.isPending) return <Loading />;
  if (query.isError) {
    if (isPlanGated(query.error)) return <PlanGateCard detail={query.error.detail} />;
    const detail = errorDetail(query.error);
    // Bubble up genuinely useful, specific messages (validation errors,
    // business-rule rejections) -- but a bare "Not Found" from a routing
    // problem isn't useful to a user, so it gets a friendlier fallback.
    const friendly = !detail || detail.toLowerCase() === "not found"
      ? "Couldn't load this right now. Pull down to try again."
      : detail;
    return <ErrorText>{friendly}</ErrorText>;
  }
  return <>{children(query.data)}</>;
}