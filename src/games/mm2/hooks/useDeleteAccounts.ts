import { useMutation, useQueryClient } from "@tanstack/react-query";
import { pb } from "../lib/pocketbase";

/** Removes accounts from tracking entirely. PocketBase has no bulk delete-by-filter over the SDK, so each id is looked up and deleted individually. */
export function useDeleteAccounts() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (userIds: number[]) => {
      await Promise.all(
        userIds.map(async (userId) => {
          const record = await pb
            .collection("mm2_accounts")
            .getFirstListItem(pb.filter("user_id = {:id}", { id: userId }), { fields: "id" });
          await pb.collection("mm2_accounts").delete(record.id);
        }),
      );
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["mm2-accounts"] });
      queryClient.invalidateQueries({ queryKey: ["mm2-all-items"] });
      queryClient.invalidateQueries({ queryKey: ["mm2-dashboard-stats"] });
    },
  });
}
