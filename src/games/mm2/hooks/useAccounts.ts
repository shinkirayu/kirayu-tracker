import { useInfiniteQuery, useQuery } from "@tanstack/react-query";
import { pb } from "../../../lib/pocketbase";
import { REFRESH } from "../../../lib/queryClient";
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
  ["mm2-accounts", f.search, f.sort, f.onlineOnly, f.inRoundOnly] as const;

const SORT_FIELD: Record<AccountFilters["sort"], string> = {
  level: "-level",
  coins: "-coins",
  shells: "-shells",
  xp: "-xp",
  username: "username",
  last_seen: "-last_seen",
};

async function fetchAccountsPage(
  filters: AccountFilters,
  page: number,
): Promise<{ rows: AccountListRow[]; hasMore: boolean }> {
  const conditions: string[] = [];
  if (filters.search) {
    conditions.push(pb.filter("(username ~ {:term} || display_name ~ {:term})", { term: filters.search }));
  }
  if (filters.onlineOnly) {
    const cutoff = pbDateString(new Date(Date.now() - ONLINE_WINDOW_MS));
    conditions.push(pb.filter("last_seen >= {:cutoff}", { cutoff }));
  }
  if (filters.inRoundOnly) {
    conditions.push("in_round = true");
  }

  // Stable tiebreaker so pagination never duplicates rows.
  const sort = `${SORT_FIELD[filters.sort]},user_id`;

  const result = await pb.collection("mm2_accounts").getList<AccountListRow>(page + 1, PAGE_SIZE, {
    filter: conditions.join(" && "),
    sort,
    fields: ACCOUNT_LIST_COLUMNS,
  });

  return { rows: result.items, hasMore: result.page < result.totalPages };
}

export function useAccounts(filters: AccountFilters) {
  return useInfiniteQuery({
    queryKey: accountsKey(filters),
    queryFn: ({ pageParam }) => fetchAccountsPage(filters, pageParam),
    initialPageParam: 0,
    getNextPageParam: (last, pages) => (last.hasMore ? pages.length : undefined),
    refetchInterval: REFRESH.accounts,
  });
}

export function useDashboardStats() {
  return useQuery({
    queryKey: ["mm2-dashboard-stats"],
    queryFn: async (): Promise<DashboardStats> => {
      return await pb.send("/api/mm2/dashboard-stats", { method: "GET" });
    },
    refetchInterval: REFRESH.stats,
  });
}
