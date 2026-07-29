import { useMemo } from "react";
import { useAllUnits } from "./useAllUnits";
import type { SecretTraitEntry, UnitEntry } from "../lib/types";

/**
 * Which two Secret-rarity units are valuable enough that owning both on one
 * account is worth listing as a "2 secrets" account. "(Divine)"/other
 * parenthesized evolutions of either unit still count as owning it.
 */
export const SECRET_UNIT_NAMES = ["Shadow", "Crow"] as const;
export type SecretUnitName = (typeof SECRET_UNIT_NAMES)[number];

export function isVariantOf(displayName: string, name: SecretUnitName): boolean {
  return displayName === name || displayName.startsWith(`${name} (`);
}

function traitNameOf(unit: UnitEntry): string | null {
  return unit.Trait?.DisplayName ?? unit.Trait?.Trait ?? null;
}

/**
 * Reuses useAllUnits()'s existing full-account-details aggregation (already
 * paid for by the Units tab) to derive, per Secret unit, the set of user_ids
 * that own it — so the dashboard can badge/filter accounts without a
 * separate heavy fetch. `traits` carries the same ownership but with each
 * copy's actual trait attached, for the dashboard's Secrets column.
 */
export function useSecretOwners() {
  const { data: units, isLoading } = useAllUnits();

  const { owners, traits } = useMemo(() => {
    const owners: Record<SecretUnitName, Set<number>> = { Shadow: new Set(), Crow: new Set() };
    const traits = new Map<number, SecretTraitEntry[]>();
    if (!units) return { owners, traits };
    for (const group of units) {
      for (const name of SECRET_UNIT_NAMES) {
        if (!isVariantOf(group.displayName, name)) continue;
        for (const owner of group.owners) {
          owners[name].add(owner.user_id);
          const trait = traitNameOf(owner);
          const list = traits.get(owner.user_id) ?? [];
          if (!list.some((e) => e.secret === name && e.trait === trait)) list.push({ secret: name, trait });
          traits.set(owner.user_id, list);
        }
      }
    }
    return { owners, traits };
  }, [units]);

  return { owners, traits, isLoading };
}
