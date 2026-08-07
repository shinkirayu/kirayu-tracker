import { useQuery } from "@tanstack/react-query";
import { pb } from "../../../lib/pocketbase";
import type { ItemCategory, ItemEntry } from "../lib/types";

export interface OwnedItem extends ItemEntry {
  user_id: number;
  username: string;
  display_name: string | null;
}

export interface AggregatedItem {
  key: string;
  name: string;
  itemType?: string;
  rarity?: string;
  image?: string;
  owners: OwnedItem[];
}

interface AccountItemsRow {
  user_id: number;
  username: string;
  display_name: string | null;
  [category: string]: unknown;
}

/**
 * API rules already scope `accounts` to the accounts this dashboard user
 * owns, so this is a small, bounded fetch (your own tracked accounts, not
 * everyone's) — safe to pull in full and aggregate client-side. Used by the
 * Items page to search/filter/sort a single category across every tracked
 * account at once. No join needed — weapons/pets/etc. live directly on the
 * same accounts record as username/display_name.
 */
export function useAllItems(category: ItemCategory) {
  return useQuery({
    queryKey: ["mm2-all-items", category],
    queryFn: async (): Promise<AggregatedItem[]> => {
      const rows = await pb
        .collection("mm2_accounts")
        .getFullList<AccountItemsRow>({ fields: `user_id,username,display_name,${category}` });

      const groups = new Map<string, AggregatedItem>();

      for (const row of rows) {
        const items = (row[category] as ItemEntry[] | undefined) ?? [];
        for (const item of items) {
          let group = groups.get(item.Key);
          if (!group) {
            group = {
              key: item.Key,
              name: item.Name,
              itemType: item.ItemType,
              rarity: item.Rarity,
              image: item.Image,
              owners: [],
            };
            groups.set(item.Key, group);
          }
          group.owners.push({
            ...item,
            user_id: row.user_id,
            username: row.username,
            display_name: row.display_name,
          });
        }
      }

      return Array.from(groups.values()).sort((a, b) => b.owners.length - a.owners.length);
    },
  });
}
