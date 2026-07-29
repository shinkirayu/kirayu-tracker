import { useMemo } from "react";
import { useAllUnits } from "./useAllUnits";
import { isVariantOf, SECRET_UNIT_NAMES } from "./useSecretOwners";
import { isAlreadyAutoswapped, type UnboundSecret } from "../lib/autoswapHistory";
import type { UnitEntry } from "../lib/types";

/** Sentinel meaning "don't filter by trait, show every copy regardless." */
export const ALL_TRAITS = "__all__";
const SECRET_RARITY = "Secret";

export interface UnboundEntry {
  unitName: string;
  /** Only set for Crow/Shadow — the only units with a configured AccountOps rule, so the only ones a swap button applies to. */
  secret: UnboundSecret | null;
  trait: string | null;
}

export interface UnboundAccountMatch {
  user_id: number;
  username: string;
  display_name: string | null;
  entries: UnboundEntry[];
}

function traitNameOf(unit: UnitEntry): string | null {
  return unit.Trait?.DisplayName ?? unit.Trait?.Trait ?? null;
}

export interface UnboundSecretsFilters {
  /** Which trait to watch for, or ALL_TRAITS to show every copy regardless of trait. */
  trait: string;
  /** Crow/Shadow only (false, default) vs every Secret-rarity unit (true). */
  allSecrets: boolean;
}

/**
 * Reuses useAllUnits()'s existing full-account aggregation (see
 * useSecretOwners.ts for the same pattern) to find tracked accounts that
 * currently own a Crow/Shadow (or, with allSecrets on, any Secret-rarity
 * unit) matching the selected trait — the signal the user wants to act on
 * by autoswapping that account out of its farm rotation. One entry per
 * account (not per unit) so an account with several matches shows up once.
 * Only Crow/Shadow entries carry a `secret` label and are swappable —
 * AccountOps only has rules configured for those two, so anything else
 * surfaced via allSecrets is informational only. Accounts already marked in
 * autoswapHistory are excluded so a completed swap doesn't keep reappearing
 * here until the tracker data catches up.
 *
 * `historyVersion` isn't otherwise used — bump it (e.g. after
 * clearAllAutoswapHistory()) to force this to re-read localStorage, since
 * that read isn't itself part of React's reactive state.
 */
export function useUnboundSecrets(filters: UnboundSecretsFilters, historyVersion = 0) {
  const { data: units, isLoading } = useAllUnits();

  const availableTraits = useMemo(() => {
    const seen = new Set<string>(["Unbound"]);
    if (units) {
      for (const group of units) {
        if (filters.allSecrets ? group.rarity !== SECRET_RARITY : !SECRET_UNIT_NAMES.some((n) => isVariantOf(group.displayName, n))) {
          continue;
        }
        for (const owner of group.owners) {
          const t = traitNameOf(owner);
          if (t) seen.add(t);
        }
      }
    }
    return Array.from(seen).sort();
  }, [units, filters.allSecrets]);

  const matches = useMemo<UnboundAccountMatch[]>(() => {
    if (!units) return [];
    const byAccount = new Map<
      number,
      { username: string; display_name: string | null; entries: Map<string, UnboundEntry> }
    >();

    for (const group of units) {
      const secret = SECRET_UNIT_NAMES.find((name) => isVariantOf(group.displayName, name)) ?? null;
      const inScope = filters.allSecrets ? group.rarity === SECRET_RARITY : secret !== null;
      if (!inScope) continue;

      for (const owner of group.owners) {
        const trait = traitNameOf(owner);
        if (filters.trait !== ALL_TRAITS && trait !== filters.trait) continue;
        if (isAlreadyAutoswapped(owner.user_id)) continue;

        const account = byAccount.get(owner.user_id) ?? {
          username: owner.username,
          display_name: owner.display_name,
          entries: new Map<string, UnboundEntry>(),
        };
        const entryKey = `${group.displayName}|${trait ?? ""}`;
        if (!account.entries.has(entryKey)) {
          account.entries.set(entryKey, { unitName: group.displayName, secret, trait });
        }
        byAccount.set(owner.user_id, account);
      }
    }

    return Array.from(byAccount, ([user_id, v]) => ({
      user_id,
      username: v.username,
      display_name: v.display_name,
      entries: Array.from(v.entries.values()),
    }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [units, filters.trait, filters.allSecrets, historyVersion]);

  return { matches, availableTraits, isLoading };
}
