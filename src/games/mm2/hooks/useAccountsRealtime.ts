import { useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { pb } from "../../../lib/pocketbase";
import type { AccountListRow, AccountRow } from "../lib/types";

type AccountsPages = { pages: Array<{ rows: AccountListRow[]; hasMore: boolean }>; pageParams: unknown[] };

/**
 * Subscribe to changes on the `accounts` collection. API rules already scope
 * every record to accounts this dashboard user owns, so any event that
 * reaches the client is guaranteed to be one of theirs. Loaded rows are
 * patched in place; the periodic query reconciles additions and ordering.
 */
export function useAccountsRealtime() {
  const queryClient = useQueryClient();

  useEffect(() => {
    let unsubscribe: (() => void) | undefined;
    let statsTimer: ReturnType<typeof setTimeout> | undefined;
    let cancelled = false;

    pb.collection("mm2_accounts")
      .subscribe<AccountListRow>("*", (event) => {
        queryClient.setQueriesData<AccountsPages>({ queryKey: ["mm2-accounts"] }, (cached) => {
          if (!cached) return cached;
          let changed = false;
          const pages = cached.pages.map((page) => {
            const index = page.rows.findIndex((row) => row.user_id === event.record.user_id);
            if (index === -1) return page;
            changed = true;
            const rows = [...page.rows];
            if (event.action === "delete") rows.splice(index, 1);
            else rows[index] = { ...rows[index], ...event.record };
            return { ...page, rows };
          });
          return changed ? { ...cached, pages } : cached;
        });
        if (statsTimer) clearTimeout(statsTimer);
        statsTimer = setTimeout(() => {
          queryClient.invalidateQueries({ queryKey: ["mm2-dashboard-stats"], refetchType: "active" });
        }, 750);
      })
      .then((unsub) => {
        if (cancelled) unsub();
        else unsubscribe = unsub;
      });

    return () => {
      cancelled = true;
      if (statsTimer) clearTimeout(statsTimer);
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
