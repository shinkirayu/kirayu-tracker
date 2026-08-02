import { useMemo } from "react";
import { useGtdAccounts, realAccounts } from "./useGtdAccounts";
import { useSeedsBaseline } from "./useSeedsBaseline";
import { isOnline } from "../lib/format";

/**
 * Aggregate account/seeds numbers shared by the global top-nav stat chips
 * and the all-games home page — factored out of AccountsPage so both
 * places compute "today" the same way instead of duplicating the reduce.
 */
export function useGtdDashboardStats() {
  const { data, isLoading } = useGtdAccounts();
  const baseline = useSeedsBaseline(data);

  const real = useMemo(() => realAccounts(data ?? []), [data]);
  const online = useMemo(() => real.filter(isOnline), [real]);

  const totalSeeds = real.reduce((sum, a) => sum + (a.seeds || 0), 0);
  const totalSeedsToday = real.reduce((sum, a) => {
    const has = Object.prototype.hasOwnProperty.call(baseline, a.username);
    return sum + (has ? (a.seeds || 0) - baseline[a.username] : 0);
  }, 0);

  return {
    isLoading,
    total: real.length,
    online: online.length,
    totalSeeds,
    totalSeedsToday,
  };
}
