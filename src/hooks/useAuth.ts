import { useEffect, useState } from "react";
import type { RecordModel } from "pocketbase";
import { pb } from "../lib/pocketbase";

/** PocketBase's AuthStore loads persisted auth synchronously from localStorage, so there's no real loading window like Supabase's async getSession(). */
export function useSession() {
  const [session, setSession] = useState<RecordModel | null>(pb.authStore.record);

  useEffect(() => {
    return pb.authStore.onChange((_token, record) => {
      setSession(record);
    });
  }, []);

  return { session, loading: false };
}
