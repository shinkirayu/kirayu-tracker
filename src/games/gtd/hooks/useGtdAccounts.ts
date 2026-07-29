import { useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { pb } from "../lib/pocketbase";
import type { GtdAccount } from "../lib/types";

const FIELDS = "id,username,seeds,status,action,updated_at,lobby,x2_seeds,x3_speed,inventory,parked_job_id,games_won,wave,units,lucky_blocks";

/** Real accounts only — `__seeds_baseline__` is a bookkeeping row, not a tracked farm account. */
export function realAccounts(accounts: GtdAccount[]): GtdAccount[] {
  return accounts.filter((a) => !a.username.startsWith("__"));
}

export function useGtdAccounts() {
  const query = useQuery({
    queryKey: ["gtd-accounts"],
    queryFn: async (): Promise<GtdAccount[]> => {
      return await pb.collection("gtd_accounts").getFullList<GtdAccount>({ fields: FIELDS });
    },
    staleTime: 60_000,
  });

  const queryClient = useQueryClient();

  // Patches the one changed/created/deleted record into the cached list in
  // place instead of re-fetching everything on every heartbeat — with 300+
  // accounts each reporting every ~15-30s, that's what keeps this reactive
  // without hammering PocketBase or the browser.
  useEffect(() => {
    let unsubscribe: (() => void) | undefined;
    let cancelled = false;

    pb.collection("gtd_accounts")
      .subscribe<GtdAccount>("*", (e) => {
        queryClient.setQueryData<GtdAccount[]>(["gtd-accounts"], (old) => {
          const list = old ? [...old] : [];
          const idx = list.findIndex((a) => a.username === e.record.username);
          if (e.action === "delete") {
            if (idx !== -1) list.splice(idx, 1);
          } else if (idx !== -1) {
            list[idx] = e.record;
          } else {
            list.push(e.record);
          }
          return list;
        });
      })
      .then((unsub) => {
        if (cancelled) unsub();
        else unsubscribe = unsub;
      });

    return () => {
      cancelled = true;
      unsubscribe?.();
    };
  }, [queryClient]);

  return query;
}
