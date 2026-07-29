import { useRef, useState } from "react";
import { pb } from "../lib/pocketbase";
import type { AccountDetailsRow, AccountRow } from "../lib/types";
import { useToast } from "../../../components/Toast";
import { DownloadIcon, UploadIcon } from "./icons";

/** Builds the same {Ready, Account, Presence, Weapons, ...} shape the tracker sends, from already-stored rows. */
function toExportPayload(account: AccountRow, details: AccountDetailsRow | null) {
  return {
    SchemaVersion: 1,
    Ready: true,
    Account: {
      Username: account.username,
      DisplayName: account.display_name,
      UserId: account.user_id,
      Coins: account.coins,
      XP: account.xp,
      Progress: account.level_progress,
      Level: account.level,
      Prestige: account.prestige,
    },
    Presence: {
      InRound: account.in_round,
      Map: account.map,
      Role: account.role,
      Gamemode: account.gamemode,
    },
    Weapons: details?.weapons ?? [],
    Pets: details?.pets ?? [],
    Effects: details?.effects ?? [],
    Toys: details?.toys ?? [],
    Emotes: details?.emotes ?? [],
    Radios: details?.radios ?? [],
    Materials: details?.materials ?? [],
  };
}

export function ImportExportPanel({ account, details }: { account: AccountRow; details: AccountDetailsRow | null }) {
  const toast = useToast();
  const [importing, setImporting] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  function exportJson() {
    const payload = toExportPayload(account, details);
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${account.username}-mm2-export.json`;
    a.click();
    URL.revokeObjectURL(url);
  }

  async function importFromText(text: string) {
    setImporting(true);
    try {
      const parsed = JSON.parse(text);
      await pb.send("/api/mm2/import-account", { method: "POST", body: parsed });
      toast.success("Imported", `${parsed?.Account?.Username ?? "Account"} data restored.`);
    } catch (err) {
      toast.error("Import failed", (err as Error).message);
    } finally {
      setImporting(false);
    }
  }

  async function onFileChosen(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    const text = await file.text();
    await importFromText(text);
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      <button
        onClick={exportJson}
        className="flex items-center gap-1.5 rounded-lg border border-zinc-200 px-3 py-1.5 text-xs font-semibold text-zinc-600 transition-colors hover:border-red-400 dark:border-white/10 dark:text-zinc-300"
      >
        <DownloadIcon /> Export JSON
      </button>
      <button
        onClick={() => fileRef.current?.click()}
        disabled={importing}
        className="flex items-center gap-1.5 rounded-lg border border-zinc-200 px-3 py-1.5 text-xs font-semibold text-zinc-600 transition-colors hover:border-red-400 disabled:opacity-50 dark:border-white/10 dark:text-zinc-300"
      >
        <UploadIcon /> {importing ? "Importing…" : "Import JSON"}
      </button>
      <input ref={fileRef} type="file" accept="application/json" className="hidden" onChange={onFileChosen} />
    </div>
  );
}
