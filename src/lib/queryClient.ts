import { QueryClient } from "@tanstack/react-query";

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      gcTime: 10 * 60_000,
      retry: 3,
      retryDelay: (attempt) => Math.min(1000 * 2 ** attempt, 8000),
      refetchOnWindowFocus: false,
      refetchOnReconnect: true,
    },
  },
});

/** Refresh intervals — tune these to trade freshness for bandwidth. */
export const REFRESH = {
  /** Account list background refetch (ms). Realtime patches rows in between. */
  accounts: 120_000,
  /** Header stat tiles (ms). */
  stats: 120_000,
  /** Heavy detail payload — no background polling; realtime + manual only. */
  details: Infinity,
} as const;
