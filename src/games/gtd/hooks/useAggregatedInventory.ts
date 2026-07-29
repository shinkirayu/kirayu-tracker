import { useMemo } from "react";
import { unitRarity } from "../lib/unitRarity";
import type { AggregatedUnit, GtdAccount } from "../lib/types";
import { realAccounts } from "./useGtdAccounts";

/** Pools every tracked account's inventory into one per-unit total + owner list — the "who has this unit" view. */
export function useAggregatedInventory(accounts: GtdAccount[] | undefined): AggregatedUnit[] {
  return useMemo(() => {
    const map = new Map<string, AggregatedUnit>();
    for (const acc of realAccounts(accounts ?? [])) {
      for (const item of acc.inventory ?? []) {
        if (!item?.id) continue;
        const qty = item.count ?? 0;
        let entry = map.get(item.id);
        if (!entry) {
          entry = {
            key: item.id,
            name: item.name || item.id,
            rarity: unitRarity(item.id),
            icon: item.image || null,
            total: 0,
            perAccount: [],
          };
          map.set(item.id, entry);
        }
        entry.total += qty;
        if (qty > 0) entry.perAccount.push({ username: acc.username, qty });
      }
    }
    return Array.from(map.values());
  }, [accounts]);
}
