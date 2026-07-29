import { useQuery } from "@tanstack/react-query";
import { pb } from "../lib/pocketbase";
import { REFRESH } from "../lib/queryClient";
import type { AccountDetailsRow, AccountRow } from "../lib/types";

/** Light row for the detail header — cheap, cached separately from the list. */
export function useAccount(userId: number | null) {
  return useQuery({
    queryKey: ["mm2-account", userId],
    enabled: userId != null,
    queryFn: async (): Promise<AccountRow> => {
      const record = await pb.collection("mm2_accounts").getFirstListItem(pb.filter("user_id = {:id}", { id: userId }));
      // PocketBase's own `created`/`updated` system timestamps stand in for
      // the old first_seen/updated_at columns.
      return { ...(record as unknown as AccountRow), first_seen: record.created, updated_at: record.updated };
    },
  });
}

/**
 * Heavy payload (per-category item arrays) — lazily fetched only when the
 * detail page mounts, never polled in the background.
 */
export function useAccountDetails(userId: number | null) {
  return useQuery({
    queryKey: ["mm2-account-details", userId],
    enabled: userId != null,
    staleTime: 60_000,
    refetchInterval: REFRESH.details === Infinity ? false : REFRESH.details,
    queryFn: async (): Promise<AccountDetailsRow | null> => {
      const record = await pb.collection("mm2_accounts").getFirstListItem(pb.filter("user_id = {:id}", { id: userId }), {
        fields: "user_id,weapons,pets,effects,toys,emotes,radios,materials,updated",
      });
      return { ...(record as unknown as AccountDetailsRow), updated_at: record.updated };
    },
  });
}
