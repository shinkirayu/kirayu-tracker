import { useInfiniteQuery, useQuery } from "@tanstack/react-query";
import { useMemo } from "react";
import { pb } from "../lib/pocketbase";
import { REFRESH } from "../lib/queryClient";
import type { SecretUnitName } from "./useSecretOwners";
import {
  ACCOUNT_LIST_COLUMNS,
  ONLINE_WINDOW_MS,
  PAGE_SIZE,
  pbDateString,
  type AccountFilters,
  type AccountListRow,
  type DashboardStats,
} from "../lib/types";

export const accountsKey = (f: AccountFilters) =>
  ["ae-accounts", f.search, f.sort, f.onlineOnly, f.inMatchOnly, f.hasShadow, f.hasCrow] as const;

const SORT_FIELD: Record<AccountFilters["sort"], string> = {
  level: "-level",
  exp: "-exp",
  username: "username",
  last_seen: "-last_seen",
};

/**
 * user_id equality can't be pushed through pb.filter's named-param binding
 * for a variable-length list, so these are interpolated directly — safe
 * since every id here comes from a `Set<number>` (useSecretOwners), never
 * from user input. `null` means "targeted user_id list not empty" was
 * never requested (secrets filters off); an empty array means the filter is
 * on but matched nobody, which must still exclude every row.
 */
function targetIdsCondition(ids: number[] | null): string | null {
  if (ids === null) return null;
  if (ids.length === 0) return "user_id < 0";
  return "(" + ids.map((id) => `user_id = ${id}`).join(" || ") + ")";
}

async function fetchAccountsPage(
  filters: AccountFilters,
  page: number,
  targetIds: number[] | null,
): Promise<{ rows: AccountListRow[]; hasMore: boolean }> {
  const conditions: string[] = [];
  if (filters.search) {
    conditions.push(pb.filter("(username ~ {:term} || display_name ~ {:term})", { term: filters.search }));
  }
  if (filters.onlineOnly) {
    const cutoff = pbDateString(new Date(Date.now() - ONLINE_WINDOW_MS));
    conditions.push(pb.filter("last_seen >= {:cutoff}", { cutoff }));
  }
  if (filters.inMatchOnly) {
    conditions.push("in_match = true");
  }
  const targetCond = targetIdsCondition(targetIds);
  if (targetCond) conditions.push(targetCond);

  // Stable tiebreaker so pagination never duplicates rows.
  const sort = `${SORT_FIELD[filters.sort]},user_id`;

  const result = await pb.collection("ae_accounts").getList<AccountListRow>(page + 1, PAGE_SIZE, {
    filter: conditions.join(" && "),
    sort,
    fields: ACCOUNT_LIST_COLUMNS,
  });

  return { rows: result.items, hasMore: result.page < result.totalPages };
}

export function useAccounts(
  filters: AccountFilters,
  secretOwners?: Record<SecretUnitName, Set<number>>,
) {
  const wantsSecretFilter = filters.hasShadow || filters.hasCrow;

  const targetIds = useMemo(() => {
    if (!wantsSecretFilter) return null;
    if (!secretOwners) return undefined; // secret ownership hasn't loaded yet
    let ids: number[];
    if (filters.hasShadow && filters.hasCrow) {
      ids = [...secretOwners.Shadow].filter((id) => secretOwners.Crow.has(id));
    } else if (filters.hasShadow) {
      ids = [...secretOwners.Shadow];
    } else {
      ids = [...secretOwners.Crow];
    }
    return ids.sort((a, b) => a - b);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [wantsSecretFilter, filters.hasShadow, filters.hasCrow, secretOwners]);

  return useInfiniteQuery({
    queryKey: [...accountsKey(filters), targetIds],
    queryFn: ({ pageParam }) => fetchAccountsPage(filters, pageParam, targetIds ?? null),
    initialPageParam: 0,
    getNextPageParam: (last, pages) => (last.hasMore ? pages.length : undefined),
    enabled: targetIds !== undefined,
    refetchInterval: REFRESH.accounts,
  });
}

export function useDashboardStats() {
  return useQuery({
    queryKey: ["ae-dashboard-stats"],
    queryFn: async (): Promise<DashboardStats> => {
      return await pb.send("/api/ae/dashboard-stats", { method: "GET" });
    },
    refetchInterval: REFRESH.stats,
  });
}
