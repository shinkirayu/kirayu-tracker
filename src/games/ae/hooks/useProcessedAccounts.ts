import { useMemo } from "react";
import { useAllUnits } from "./useAllUnits";
import { useSecretOwners } from "./useSecretOwners";
import { getAllAutoswapRecords, type AutoswapRecord } from "../lib/autoswapHistory";
import { getAllListedRecords, type ListedRecord } from "../lib/listedAccounts";
import type { SecretTraitEntry } from "../lib/types";

export interface ProcessedAccount {
  user_id: number;
  username: string;
  display_name: string | null;
  swapped: AutoswapRecord | null;
  listed: ListedRecord | null;
  /**
   * This account's Crow/Shadow + trait right now, read live off its tracked
   * units — not the (possibly stale, possibly trait-less) snapshot saved at
   * swap time. Prefer this for display; it's empty once the account no
   * longer owns the unit (e.g. a fresh account has since taken its user_id).
   */
  liveSecretTraits: SecretTraitEntry[];
  /** Most recent timestamp across swap/listing activity — used to sort newest first. */
  lastActivity: string;
}

/**
 * Combines two local-only lifecycle signals into one view: accounts pulled
 * out of farming (autoswapHistory, see useUnboundSecrets.ts) and accounts
 * already published on Eldorado/ZeusX (listedAccounts, same data the Units
 * tab's "Listed" badge already reads). Usernames aren't stored in either —
 * both are keyed by user_id only — so this cross-references them against
 * useAllUnits()'s existing aggregation (already fetches every tracked
 * account's owned units, so virtually every real account appears somewhere
 * in it). Also pulls in useSecretOwners()'s live per-account trait data
 * (same source as the Accounts/Units tabs) so a swap recorded before trait
 * tracking existed can still show its current real trait instead of "—".
 */
export function useProcessedAccounts(historyVersion = 0) {
  const { data: units, isLoading } = useAllUnits();
  const { traits: liveTraits } = useSecretOwners();

  const accounts = useMemo<ProcessedAccount[]>(() => {
    const swapped = getAllAutoswapRecords();
    const listed = getAllListedRecords();

    const userIds = new Set<number>();
    for (const key of Object.keys(swapped)) userIds.add(Number(key));
    for (const key of Object.keys(listed)) userIds.add(Number(key));
    if (userIds.size === 0) return [];

    const identities = new Map<number, { username: string; display_name: string | null }>();
    if (units) {
      for (const group of units) {
        for (const owner of group.owners) {
          if (!identities.has(owner.user_id)) {
            identities.set(owner.user_id, { username: owner.username, display_name: owner.display_name });
          }
        }
      }
    }

    const result: ProcessedAccount[] = [];
    for (const userId of userIds) {
      const identity = identities.get(userId);
      const swap = swapped[String(userId)] ?? null;
      const list = listed[String(userId)] ?? null;
      const lastActivity = [swap?.at, list?.eldorado, list?.zeusx].filter((v): v is string => !!v).sort().at(-1) ?? "";
      result.push({
        user_id: userId,
        username: identity?.username ?? `#${userId}`,
        display_name: identity?.display_name ?? null,
        swapped: swap,
        listed: list,
        liveSecretTraits: liveTraits.get(userId) ?? [],
        lastActivity,
      });
    }

    return result.sort((a, b) => b.lastActivity.localeCompare(a.lastActivity));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [units, liveTraits, historyVersion]);

  return { accounts, isLoading };
}
