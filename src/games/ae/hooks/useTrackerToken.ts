import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { pb } from "../../../lib/pocketbase";

/** Each dashboard user has exactly one tracker token, lazily issued on first call. */
export function useTrackerToken() {
  return useQuery({
    queryKey: ["ae-tracker-token"],
    queryFn: async () => {
      const { token } = await pb.send<{ token: string }>("/api/ae/tracker-token", { method: "GET" });
      return token;
    },
    staleTime: Infinity,
  });
}

/** Invalidates the current token and mints a new one — any script using the old one stops working immediately. */
export function useRegenerateTrackerToken() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      const { token } = await pb.send<{ token: string }>("/api/ae/tracker-token/regenerate", { method: "POST" });
      return token;
    },
    onSuccess: (token) => {
      queryClient.setQueryData(["ae-tracker-token"], token);
    },
  });
}
