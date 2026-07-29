import { useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { pb } from "../lib/pocketbase";
import type { AccountRow } from "../lib/types";

/**
 * Subscribe to changes on the `ae_accounts` collection. API rules already
 * scope every record to accounts this dashboard user owns, so any event that
 * reaches the client is guaranteed to be one of theirs. On any
 * create/update/delete, invalidate the list + stats queries so they refetch.
 */
export function useAccountsRealtime() {
  const queryClient = useQueryClient();

  useEffect(() => {
    let unsubscribe: (() => void) | undefined;
    let cancelled = false;

    pb.collection("ae_accounts")
      .subscribe("*", () => {
        queryClient.invalidateQueries({ queryKey: ["ae-accounts"] });
        queryClient.invalidateQueries({ queryKey: ["ae-dashboard-stats"] });
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

    pb.collection("ae_accounts")
      .subscribe("*", (e) => {
        const record = e.record as unknown as AccountRow & { user_id: number };
        if (record.user_id !== userId) return;
        if (e.action === "update") {
          queryClient.setQueryData<AccountRow>(["ae-account", userId], (old) => ({ ...(old ?? record), ...record }));
          // Heavy payload changed too — refetch it lazily next time it's needed.
          queryClient.invalidateQueries({ queryKey: ["ae-account-details", userId] });
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
