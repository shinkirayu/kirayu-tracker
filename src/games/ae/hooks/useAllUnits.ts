import { useQuery } from "@tanstack/react-query";
import { pb } from "../lib/pocketbase";
import type { UnitEntry } from "../lib/types";

export interface OwnedUnit extends UnitEntry {
  user_id: number;
  username: string;
  display_name: string | null;
}

export interface AggregatedUnit {
  key: string;
  displayName: string;
  rarity?: string;
  element?: string;
  archetype?: string;
  owners: OwnedUnit[];
}

interface DetailsRow {
  user_id: number;
  units: UnitEntry[];
  username: string;
  display_name: string | null;
}

/**
 * API rules already scope ae_account_details to accounts this dashboard user
 * owns, so this is a small, bounded fetch (your own tracked accounts, not
 * everyone's) — safe to pull in full and aggregate client-side.
 */
export function useAllUnits() {
  return useQuery({
    queryKey: ["ae-all-units"],
    queryFn: async (): Promise<AggregatedUnit[]> => {
      const rows = await pb.collection("ae_account_details").getFullList<DetailsRow>({
        fields: "user_id,units,username,display_name",
      });

      const groups = new Map<string, AggregatedUnit>();

      for (const row of rows) {
        for (const unit of row.units ?? []) {
          const key = unit.DisplayName || unit.Asset || "Unknown";
          let group = groups.get(key);
          if (!group) {
            group = {
              key,
              displayName: key,
              rarity: unit.Rarity,
              element: unit.Element,
              archetype: unit.Archetype,
              owners: [],
            };
            groups.set(key, group);
          }
          group.owners.push({
            ...unit,
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
