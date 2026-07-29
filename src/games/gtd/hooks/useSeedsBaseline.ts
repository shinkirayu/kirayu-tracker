import { useEffect, useRef, useState } from "react";
import { pb } from "../lib/pocketbase";
import { localDateStr } from "../lib/format";
import type { GtdAccount } from "../lib/types";
import { realAccounts } from "./useGtdAccounts";

const BASELINE_USERNAME = "__seeds_baseline__";

interface BaselineRecord {
  id: string;
  username: string;
  lobby: string; // the local date this snapshot was taken
  inventory: { id: string; count: number }[]; // id = username, count = seeds at snapshot time
}

function baselineFromRecord(rec: BaselineRecord | null): Record<string, number> | null {
  if (!rec || rec.lobby !== localDateStr()) return null;
  const map: Record<string, number> = {};
  for (const item of rec.inventory ?? []) {
    if (item?.id) map[item.id] = item.count || 0;
  }
  return map;
}

function baselineFromCurrentSeeds(accounts: GtdAccount[]): Record<string, number> {
  const map: Record<string, number> = {};
  for (const a of realAccounts(accounts)) map[a.username] = Number(a.seeds || 0);
  return map;
}

/**
 * "Seeds today" is tracked via a daily snapshot stored in a special
 * `__seeds_baseline__` gtd_accounts record: { lobby: "YYYY-MM-DD", inventory:
 * [{id: username, count: seedsAtSnapshot}, ...] }. Written through so every
 * other open tab/device picks up the same snapshot instead of each one
 * inventing its own baseline independently, and re-derived automatically at
 * local-midnight rollover.
 */
export function useSeedsBaseline(accounts: GtdAccount[] | undefined) {
  const [baseline, setBaseline] = useState<Record<string, number>>({});
  const recordId = useRef<string | null>(null);
  const localDate = useRef(localDateStr());
  const initialized = useRef(false);

  async function saveBaseline(map: Record<string, number>) {
    const today = localDateStr();
    const inventory = Object.entries(map).map(([username, seeds]) => ({ id: username, name: today, count: seeds, image: "" }));
    const body = { username: BASELINE_USERNAME, seeds: 0, status: "baseline", lobby: today, inventory };
    try {
      if (!recordId.current) {
        const existing = await pb
          .collection("gtd_accounts")
          .getFirstListItem<BaselineRecord>(pb.filter("username = {:u}", { u: BASELINE_USERNAME }))
          .catch(() => null);
        if (existing) recordId.current = existing.id;
      }
      if (recordId.current) {
        await pb.collection("gtd_accounts").update(recordId.current, body);
      } else {
        const created = await pb.collection("gtd_accounts").create<BaselineRecord>(body);
        recordId.current = created.id;
      }
    } catch {
      /* best-effort — a failed baseline write just means "seeds today" stays unset a bit longer */
    }
  }

  useEffect(() => {
    if (!accounts || initialized.current) return;
    initialized.current = true;

    (async () => {
      const existing = await pb
        .collection("gtd_accounts")
        .getFirstListItem<BaselineRecord>(pb.filter("username = {:u}", { u: BASELINE_USERNAME }))
        .catch(() => null);
      if (existing) recordId.current = existing.id;

      const fromServer = baselineFromRecord(existing);
      if (fromServer) {
        setBaseline(fromServer);
      } else {
        const fresh = baselineFromCurrentSeeds(accounts);
        setBaseline(fresh);
        saveBaseline(fresh);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [accounts]);

  // Catches the local-date rollover for tabs left open across midnight.
  useEffect(() => {
    const interval = setInterval(() => {
      const today = localDateStr();
      if (today === localDate.current || !accounts) return;
      localDate.current = today;
      const fresh = baselineFromCurrentSeeds(accounts);
      setBaseline(fresh);
      saveBaseline(fresh);
    }, 60_000);
    return () => clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [accounts]);

  // Realtime: another tab/device pushing a fresh baseline record updates this one too.
  useEffect(() => {
    let unsubscribe: (() => void) | undefined;
    let cancelled = false;

    pb.collection("gtd_accounts")
      .subscribe<BaselineRecord>("*", (e) => {
        if (e.record.username !== BASELINE_USERNAME) return;
        if (e.action === "delete") {
          setBaseline({});
          return;
        }
        const map = baselineFromRecord(e.record);
        if (map) setBaseline(map);
      })
      .then((unsub) => {
        if (cancelled) unsub();
        else unsubscribe = unsub;
      });

    return () => {
      cancelled = true;
      unsubscribe?.();
    };
  }, []);

  return baseline;
}
