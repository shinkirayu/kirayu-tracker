import { useMutation, useQueryClient } from "@tanstack/react-query";
import { pb } from "../lib/pocketbase";

/** Removes accounts (and their cascaded ae_account_details) from tracking entirely. PocketBase has no bulk delete-by-filter over the SDK, so each id is looked up and deleted individually. */
export function useDeleteAccounts() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (userIds: number[]) => {
      await Promise.all(
        userIds.map(async (userId) => {
          const record = await pb
            .collection("ae_accounts")
            .getFirstListItem(pb.filter("user_id = {:id}", { id: userId }), { fields: "id" });
          await pb.collection("ae_accounts").delete(record.id);
        }),
      );
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["ae-accounts"] });
      queryClient.invalidateQueries({ queryKey: ["ae-all-units"] });
      queryClient.invalidateQueries({ queryKey: ["ae-dashboard-stats"] });
    },
  });
}
