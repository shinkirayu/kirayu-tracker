import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { pb } from "../../../lib/pocketbase";

interface ItemValueOverrideRow {
  item_key: string;
  value: number | null;
}

/** All of this dashboard user's manually-entered item values, keyed by item Key. */
export function useItemValueOverrides() {
  return useQuery({
    queryKey: ["mm2-item-value-overrides"],
    queryFn: async (): Promise<Record<string, number>> => {
      const rows = await pb.collection("mm2_item_value_overrides").getFullList<ItemValueOverrideRow>({
        fields: "item_key,value",
      });
      const map: Record<string, number> = {};
      for (const row of rows) {
        if (row.value != null) map[row.item_key] = row.value;
      }
      return map;
    },
    staleTime: 30_000,
  });
}

/** Set (or clear, with value=null) the estimated value for one item key. */
export function useSetItemValue() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ itemKey, value }: { itemKey: string; value: number | null }) => {
      const ownerId = pb.authStore.record?.id;
      if (!ownerId) throw new Error("not authenticated");

      let existing;
      try {
        existing = await pb
          .collection("mm2_item_value_overrides")
          .getFirstListItem(pb.filter("owner = {:owner} && item_key = {:key}", { owner: ownerId, key: itemKey }));
      } catch {
        existing = null;
      }

      if (value == null) {
        if (existing) await pb.collection("mm2_item_value_overrides").delete(existing.id);
        return;
      }

      if (existing) {
        await pb.collection("mm2_item_value_overrides").update(existing.id, { value });
      } else {
        await pb.collection("mm2_item_value_overrides").create({ owner: ownerId, item_key: itemKey, value });
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["mm2-item-value-overrides"] });
    },
  });
}
