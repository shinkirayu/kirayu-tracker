import { useMemo } from "react";
import { useAllUnits } from "./useAllUnits";
import { isVariantOf, SECRET_UNIT_NAMES } from "./useSecretOwners";
import { isAlreadyAutoswapped, type UnboundSecret } from "../lib/autoswapHistory";
import type { UnitEntry } from "../lib/types";

export interface UnboundAccountMatch {
  user_id: number;
  username: string;
  display_name: string | null;
  /** One or both — an account can roll an Unbound Crow and an Unbound Shadow at the same time. */
  secrets: UnboundSecret[];
}

const UNBOUND_TRAIT = "Unbound";

function hasUnboundTrait(unit: UnitEntry): boolean {
  const trait = unit.Trait;
  if (!trait) return false;
  return trait.DisplayName === UNBOUND_TRAIT || trait.Trait === UNBOUND_TRAIT;
}

/**
 * Reuses useAllUnits()'s existing full-account aggregation (see
 * useSecretOwners.ts for the same pattern) to find tracked accounts that
 * currently own a Crow or Shadow secret with the "Unbound" trait — the
 * signal the user wants to act on by autoswapping that account out of its
 * farm rotation. One entry per account (not per secret) so an account with
 * both shows up once, with both secrets attached — that's the case the
 * Autoswap page treats as a separate, higher-value rule. Accounts already
 * marked in autoswapHistory are excluded so a completed swap doesn't keep
 * reappearing here until the tracker data catches up (or the account gets
 * replaced with a fresh one at that user_id, at which point it naturally
 * won't match anymore anyway).
 *
 * `historyVersion` isn't otherwise used — bump it (e.g. after
 * clearAllAutoswapHistory()) to force this to re-read localStorage, since
 * that read isn't itself part of React's reactive state.
 */
export function useUnboundSecrets(historyVersion = 0) {
  const { data: units, isLoading } = useAllUnits();

  const matches = useMemo<UnboundAccountMatch[]>(() => {
    if (!units) return [];
    const byAccount = new Map<
      number,
      { username: string; display_name: string | null; secrets: Set<UnboundSecret> }
    >();

    for (const group of units) {
      const secret = SECRET_UNIT_NAMES.find((name) => isVariantOf(group.displayName, name));
      if (!secret) continue;
      for (const owner of group.owners) {
        if (!hasUnboundTrait(owner)) continue;
        if (isAlreadyAutoswapped(owner.user_id)) continue;
        const entry = byAccount.get(owner.user_id) ?? {
          username: owner.username,
          display_name: owner.display_name,
          secrets: new Set<UnboundSecret>(),
        };
        entry.secrets.add(secret);
        byAccount.set(owner.user_id, entry);
      }
    }

    return Array.from(byAccount, ([user_id, v]) => ({
      user_id,
      username: v.username,
      display_name: v.display_name,
      secrets: [...v.secrets],
    }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [units, historyVersion]);

  return { matches, isLoading };
}
