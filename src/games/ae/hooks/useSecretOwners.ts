import { useMemo } from "react";
import { useAllUnits } from "./useAllUnits";

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

/**
 * Reuses useAllUnits()'s existing full-account-details aggregation (already
 * paid for by the Units tab) to derive, per Secret unit, the set of user_ids
 * that own it — so the dashboard can badge/filter accounts without a
 * separate heavy fetch.
 */
export function useSecretOwners() {
  const { data: units, isLoading } = useAllUnits();

  const owners = useMemo(() => {
    const result: Record<SecretUnitName, Set<number>> = { Shadow: new Set(), Crow: new Set() };
    if (!units) return result;
    for (const group of units) {
      for (const name of SECRET_UNIT_NAMES) {
        if (isVariantOf(group.displayName, name)) {
          for (const owner of group.owners) result[name].add(owner.user_id);
        }
      }
    }
    return result;
  }, [units]);

  return { owners, isLoading };
}
