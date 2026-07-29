import { useState } from "react";
import { GAMES, getEnabledGames, setEnabledGames, type GameId } from "../lib/pocketbase";
import { useToast } from "../components/Toast";

const ALL_GAMES = Object.keys(GAMES) as GameId[];

export default function SettingsPage() {
  const [games, setGames] = useState<GameId[]>(getEnabledGames());
  const [busy, setBusy] = useState(false);
  const toast = useToast();

  function toggleGame(id: GameId) {
    setGames((g) => (g.includes(id) ? g.filter((x) => x !== id) : [...g, id]));
  }

  async function save() {
    setBusy(true);
    try {
      await setEnabledGames(games);
      toast.success("Saved", "Your game switcher will update on next load.");
    } catch (err) {
      toast.error("Couldn't save", (err as Error).message);
    }
    setBusy(false);
  }

  return (
    <div className="mx-auto max-w-md">
      <h1 className="mb-4 text-lg font-semibold">Settings</h1>
      <label className="mb-1.5 block text-xs font-semibold">Tracked games</label>
      <div className="space-y-1.5">
        {ALL_GAMES.map((id) => (
          <label
            key={id}
            className="flex cursor-pointer items-center gap-2 rounded-lg border border-zinc-200 px-3 py-2 text-sm hover:bg-zinc-50 dark:border-zinc-700 dark:hover:bg-white/5"
          >
            <input type="checkbox" checked={games.includes(id)} onChange={() => toggleGame(id)} />
            {GAMES[id].label}
          </label>
        ))}
      </div>
      <button
        onClick={save}
        disabled={busy}
        className="mt-4 rounded-full bg-indigo-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition-opacity hover:opacity-90 disabled:opacity-50"
      >
        {busy ? "Saving…" : "Save"}
      </button>
    </div>
  );
}
