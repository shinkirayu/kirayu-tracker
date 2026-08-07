import { useMutation, useQueryClient } from "@tanstack/react-query";
import { pb } from "../../../lib/pocketbase";

/** Sparse patch — only the keys present are written by /api/mm2/edit-account. */
export interface AccountPatch {
  display_name?: string | null;
  level?: number | null;
  prestige?: number;
  coins?: number | null;
  xp?: number | null;
  next_level_xp?: number | null;
  role?: string | null;
  map?: string | null;
  gamemode?: string | null;
  in_round?: boolean;
}

/** Manually corrects an owned account's light-table fields via /api/mm2/edit-account. */
export function useEditAccount(userId: number | null) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (patch: AccountPatch) => {
      if (userId == null) throw new Error("no account selected");
      await pb.send("/api/mm2/edit-account", { method: "POST", body: { user_id: userId, patch } });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["mm2-account", userId] });
      queryClient.invalidateQueries({ queryKey: ["mm2-accounts"] });
      queryClient.invalidateQueries({ queryKey: ["mm2-dashboard-stats"] });
    },
  });
}
