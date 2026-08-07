import { useEffect, useState } from "react";
import type { AccountRow } from "../lib/types";
import { useEditAccount, type AccountPatch } from "../hooks/useEditAccount";
import { useToast } from "../../../components/Toast";
import { CloseButton } from "../../../components/CloseButton";

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs font-semibold text-zinc-500 dark:text-zinc-400">{label}</span>
      {children}
    </label>
  );
}

const inputClass =
  "w-full rounded-lg border border-zinc-200 bg-white px-2.5 py-1.5 text-sm outline-none focus:border-red-400 dark:border-white/10 dark:bg-white/[0.04] dark:text-zinc-100";

export function EditAccountModal({ account, onClose }: { account: AccountRow; onClose: () => void }) {
  const toast = useToast();
  const editAccount = useEditAccount(account.user_id);

  const [displayName, setDisplayName] = useState(account.display_name ?? "");
  const [level, setLevel] = useState(account.level != null ? String(account.level) : "");
  const [prestige, setPrestige] = useState(String(account.prestige));
  const [coins, setCoins] = useState(account.coins != null ? String(account.coins) : "");
  const [xp, setXp] = useState(account.xp != null ? String(account.xp) : "");
  const [nextLevelXp, setNextLevelXp] = useState(account.next_level_xp != null ? String(account.next_level_xp) : "");
  const [role, setRole] = useState(account.role ?? "");
  const [map, setMap] = useState(account.map ?? "");
  const [gamemode, setGamemode] = useState(account.gamemode ?? "");
  const [inRound, setInRound] = useState(account.in_round);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  function toIntOrNull(v: string): number | null {
    const t = v.trim();
    if (t === "") return null;
    const n = Number(t);
    return Number.isFinite(n) ? Math.trunc(n) : null;
  }

  function submit(e: React.FormEvent) {
    e.preventDefault();
    const patch: AccountPatch = {
      display_name: displayName.trim() === "" ? null : displayName.trim(),
      level: toIntOrNull(level),
      prestige: toIntOrNull(prestige) ?? 0,
      coins: toIntOrNull(coins),
      xp: toIntOrNull(xp),
      next_level_xp: toIntOrNull(nextLevelXp),
      role: role.trim() === "" ? null : role.trim(),
      map: map.trim() === "" ? null : map.trim(),
      gamemode: gamemode.trim() === "" ? null : gamemode.trim(),
      in_round: inRound,
    };
    editAccount.mutate(patch, {
      onSuccess: () => {
        toast.success("Account updated");
        onClose();
      },
      onError: (err) => toast.error("Couldn't update account", (err as Error).message),
    });
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <div
        className="max-h-[90vh] w-full max-w-md overflow-y-auto rounded-2xl border border-zinc-200 bg-white shadow-xl dark:border-red-500/15 dark:bg-[#150a0d]"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="sticky top-0 flex items-center justify-between border-b border-zinc-200 bg-white p-4 dark:border-red-500/10 dark:bg-[#150a0d]">
          <h2 className="font-display font-semibold">Edit account</h2>
          <CloseButton onClick={onClose} />
        </div>

        <form onSubmit={submit} className="space-y-3 p-4 text-sm">
          <Field label="Display name">
            <input className={inputClass} value={displayName} onChange={(e) => setDisplayName(e.target.value)} />
          </Field>

          <div className="grid grid-cols-2 gap-3">
            <Field label="Level">
              <input
                className={inputClass}
                type="number"
                value={level}
                onChange={(e) => setLevel(e.target.value)}
              />
            </Field>
            <Field label="Prestige">
              <input
                className={inputClass}
                type="number"
                value={prestige}
                onChange={(e) => setPrestige(e.target.value)}
              />
            </Field>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <Field label="Coins">
              <input className={inputClass} type="number" value={coins} onChange={(e) => setCoins(e.target.value)} />
            </Field>
            <Field label="XP">
              <input className={inputClass} type="number" value={xp} onChange={(e) => setXp(e.target.value)} />
            </Field>
          </div>

          <Field label="Next level XP">
            <input
              className={inputClass}
              type="number"
              value={nextLevelXp}
              onChange={(e) => setNextLevelXp(e.target.value)}
            />
          </Field>

          <div className="grid grid-cols-2 gap-3">
            <Field label="Map">
              <input className={inputClass} value={map} onChange={(e) => setMap(e.target.value)} />
            </Field>
            <Field label="Gamemode">
              <input className={inputClass} value={gamemode} onChange={(e) => setGamemode(e.target.value)} />
            </Field>
          </div>

          <Field label="Role">
            <input className={inputClass} value={role} onChange={(e) => setRole(e.target.value)} />
          </Field>

          <label className="flex items-center gap-2 text-xs font-semibold text-zinc-500 dark:text-zinc-400">
            <input
              type="checkbox"
              checked={inRound}
              onChange={(e) => setInRound(e.target.checked)}
              className="size-4 accent-red-600"
            />
            In round
          </label>

          <p className="rounded-lg bg-amber-50 p-3 text-xs text-amber-800 dark:bg-amber-500/10 dark:text-amber-300">
            Manual edits are overwritten the next time this account's tracker reports in.
          </p>

          <button
            type="submit"
            disabled={editAccount.isPending}
            className="font-display gradient-blood w-full rounded-full py-2 text-sm font-semibold text-white shadow-[0_0_14px_rgba(165,0,8,0.45)] transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {editAccount.isPending ? "Saving…" : "Save changes"}
          </button>
        </form>
      </div>
    </div>
  );
}
