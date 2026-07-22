import { QueryClient } from "@tanstack/react-query";

import { isPlanGated } from "./api-client";

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      retry: (failureCount, error) => !isPlanGated(error) && failureCount < 2,
    },
  },
});
