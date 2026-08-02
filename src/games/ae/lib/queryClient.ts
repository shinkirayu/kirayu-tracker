export { queryClient } from "../../../lib/queryClient";

/** Refresh intervals — tune these to trade freshness for bandwidth. */
export const REFRESH = {
  /** Account list background refetch (ms). Realtime patches rows in between. */
  accounts: 120_000,
  /** Header stat tiles (ms). */
  stats: 120_000,
  /** Heavy detail payload — no background polling; realtime + manual only. */
  details: Infinity,
} as const;
