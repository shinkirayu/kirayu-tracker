import { useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { pb } from "../lib/pocketbase";
import type { AccountRow } from "../lib/types";

/**
 * Subscribe to changes on the `accounts` collection. API rules already scope
 * every record to accounts this dashboard user owns, so any event that
 * reaches the client is guaranteed to be one of theirs. On any
 * create/update/delete, invalidate the list + stats queries so they refetch.
 * This is simpler (and much more reliable) than hand-patching the cache for
 * specific visible rows, at the cost of one extra read per change instead of
 * zero.
 */
export function useAccountsRealtime() {
  const queryClient = useQueryClient();

  useEffect(() => {
    let unsubscribe: (() => void) | undefined;
    let cancelled = false;

    pb.collection("mm2_accounts")
      .subscribe("*", () => {
        queryClient.invalidateQueries({ queryKey: ["mm2-accounts"] });
        queryClient.invalidateQueries({ queryKey: ["mm2-dashboard-stats"] });
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
}

/**
 * Single-account subscription for the detail page. Subscribes to the whole
 * collection (PocketBase realtime topics key off the record's own opaque
 * `id`, not our `user_id` field) and filters client-side — cheap given one
 * dashboard user only ever tracks a handful of accounts.
 */
export function useAccountRealtime(userId: number | null) {
  const queryClient = useQueryClient();

  useEffect(() => {
    if (userId == null) return;

    let unsubscribe: (() => void) | undefined;
    let cancelled = false;

    pb.collection("mm2_accounts")
      .subscribe("*", (e) => {
        const record = e.record as unknown as AccountRow & { user_id: number; created: string; updated: string };
        if (record.user_id !== userId) return;
        if (e.action === "update") {
          queryClient.setQueryData<AccountRow>(["mm2-account", userId], (old) => ({
            ...(old ?? record),
            ...record,
            first_seen: record.created,
            updated_at: record.updated,
          }));
          // Heavy payload changed too — refetch it lazily next time it's needed.
          queryClient.invalidateQueries({ queryKey: ["mm2-account-details", userId] });
        }
      })
      .then((unsub) => {
        if (cancelled) unsub();
        else unsubscribe = unsub;
      });

    return () => {
      cancelled = true;
      unsubscribe?.();
    };
  }, [userId, queryClient]);
}
