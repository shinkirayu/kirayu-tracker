import { useQuery } from "@tanstack/react-query";
import { pb } from "../../../lib/pocketbase";
import type { ShopUnit } from "../lib/types";

/** Real lobby shop units scraped by the farm script into gtd_shop_units (unit_id/name/price) — not a guessed static catalog. */
export function useShopUnits() {
  return useQuery({
    queryKey: ["gtd-shop-units"],
    queryFn: async (): Promise<ShopUnit[]> => {
      return await pb.collection("gtd_shop_units").getFullList<ShopUnit>({ sort: "price" });
    },
    staleTime: 5 * 60_000,
  });
}
