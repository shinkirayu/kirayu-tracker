import { useEffect } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { pb } from "../lib/pocketbase";
import type { SummonConfig } from "../lib/types";

export function useSummonConfigs() {
  const query = useQuery({
    queryKey: ["gtd-summon-configs"],
    queryFn: async (): Promise<SummonConfig[]> => {
      return await pb.collection("gtd_summon_config").getFullList<SummonConfig>();
    },
    staleTime: 60_000,
  });

  const queryClient = useQueryClient();

  // Same patch-in-place pattern as accounts — keeps the Automation tab's
  // list live without polling.
  useEffect(() => {
    let unsubscribe: (() => void) | undefined;
    let cancelled = false;

    pb.collection("gtd_summon_config")
      .subscribe<SummonConfig>("*", (e) => {
        queryClient.setQueryData<SummonConfig[]>(["gtd-summon-configs"], (old) => {
          const list = old ? [...old] : [];
          const idx = list.findIndex((c) => c.username === e.record.username);
          if (e.action === "delete") {
            if (idx !== -1) list.splice(idx, 1);
          } else if (idx !== -1) {
            list[idx] = e.record;
          } else {
            list.push(e.record);
          }
          return list;
        });
      })
      .then((unsub) => {
        if (cancelled) unsub();
        else unsubscribe = unsub;
      });

    return () => {
      cancelled = true;
      unsubscribe?.();
    };
  }, [queryClient]);

  return query;
}

/**
 * PATCHes/creates the account's gtd_summon_config record — the same
 * collection summon_remote.lua / headless-kaitun.lua poll every 5s, so
 * changes here take effect on the bot automatically.
 */
export function useSaveSummonConfig() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ username, patch }: { username: string; patch: Partial<SummonConfig> }) => {
      const existing = await pb
        .collection("gtd_summon_config")
        .getFirstListItem<SummonConfig>(pb.filter("username = {:u}", { u: username }))
        .catch(() => null);

      if (existing) {
        return await pb.collection("gtd_summon_config").update<SummonConfig>(existing.id, patch);
      }
      return await pb.collection("gtd_summon_config").create<SummonConfig>({ username, ...patch });
    },
    onSuccess: (rec) => {
      queryClient.setQueryData<SummonConfig[]>(["gtd-summon-configs"], (old) => {
        const list = old ? [...old] : [];
        const idx = list.findIndex((c) => c.username === rec.username);
        if (idx !== -1) list[idx] = rec;
        else list.push(rec);
        return list;
      });
    },
  });
}
