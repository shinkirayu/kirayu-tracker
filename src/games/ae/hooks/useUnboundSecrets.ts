import { useMemo } from "react";
import { useAllUnits } from "./useAllUnits";
import { isVariantOf, SECRET_UNIT_NAMES } from "./useSecretOwners";
import { isAlreadyAutoswapped, type UnboundSecret } from "../lib/autoswapHistory";
import type { UnitEntry } from "../lib/types";

export interface UnboundSecretMatch {
  user_id: number;
  username: string;
  display_name: string | null;
  secret: UnboundSecret;
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
 * farm rotation. Accounts already marked in autoswapHistory are excluded so
 * a completed swap doesn't keep reappearing here until the tracker data
 * catches up (or the account gets replaced with a fresh one at that
 * user_id, at which point it naturally won't match anymore anyway).
 */
export function useUnboundSecrets() {
  const { data: units, isLoading } = useAllUnits();

  const matches = useMemo<UnboundSecretMatch[]>(() => {
    if (!units) return [];
    const result: UnboundSecretMatch[] = [];
    for (const group of units) {
      const secret = SECRET_UNIT_NAMES.find((name) => isVariantOf(group.displayName, name));
      if (!secret) continue;
      for (const owner of group.owners) {
        if (!hasUnboundTrait(owner)) continue;
        if (isAlreadyAutoswapped(owner.user_id)) continue;
        result.push({
          user_id: owner.user_id,
          username: owner.username,
          display_name: owner.display_name,
          secret,
        });
      }
    }
    return result;
  }, [units]);

  return { matches, isLoading };
}
