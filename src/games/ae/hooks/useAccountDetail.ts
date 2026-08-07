import { useQuery } from "@tanstack/react-query";
import { pb } from "../../../lib/pocketbase";
import { REFRESH } from "../../../lib/queryClient";
import type { AccountDetailsRow, AccountRow } from "../lib/types";
import type { ClientResponseError } from "pocketbase";

function isNotFound(err: unknown): boolean {
  return (err as ClientResponseError)?.status === 404;
}

/** Light row for the detail header — cheap, cached separately from the list. */
export function useAccount(userId: number | null) {
  return useQuery({
    queryKey: ["ae-account", userId],
    enabled: userId != null,
    queryFn: async (): Promise<AccountRow> => {
      return await pb.collection("ae_accounts").getFirstListItem<AccountRow>(pb.filter("user_id = {:id}", { id: userId! }));
    },
  });
}

/**
 * Looks up a tracked account by username (case-insensitive) instead of user_id —
 * used where only a username is known, e.g. matching a Bulk Accounts pool
 * entry back to its tracked account for the showcase auto-fetch.
 */
export function useAccountByUsername(username: string | null) {
  return useQuery({
    queryKey: ["ae-account-by-username", username?.toLowerCase()],
    enabled: !!username,
    queryFn: async (): Promise<AccountRow | null> => {
      try {
        return await pb.collection("ae_accounts").getFirstListItem<AccountRow>(pb.filter("username ~ {:u}", { u: username! }));
      } catch (err) {
        if (isNotFound(err)) return null;
        throw err;
      }
    },
  });
}

/**
 * Heavy payload (units + inventory) — lazily fetched only when the detail
 * page mounts, never polled in the background.
 */
export function useAccountDetails(userId: number | null) {
  return useQuery({
    queryKey: ["ae-account-details", userId],
    enabled: userId != null,
    staleTime: 60_000,
    refetchInterval: REFRESH.details === Infinity ? false : REFRESH.details,
    queryFn: async (): Promise<AccountDetailsRow | null> => {
      let record;
      try {
        record = await pb
          .collection("ae_account_details")
          .getFirstListItem<Record<string, unknown>>(pb.filter("user_id = {:id}", { id: userId! }), {
            fields: "user_id,units,inventory,equipment,raw,updated_at",
          });
      } catch (err) {
        if (isNotFound(err)) return null;
        throw err;
      }
      const raw = record.raw as { Pity?: AccountDetailsRow["pity"] } | null;
      const { raw: _raw, ...rest } = record;
      return { ...rest, pity: raw?.Pity ?? {} } as unknown as AccountDetailsRow;
    },
  });
}
