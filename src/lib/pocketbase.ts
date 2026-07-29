import PocketBase from "pocketbase";

const url = import.meta.env.VITE_POCKETBASE_URL as string | undefined;

if (!url) {
  throw new Error("Missing VITE_POCKETBASE_URL — copy .env.example to .env");
}

// One PocketBase client, one `users` auth session, shared by every game
// module — this is what makes login unified across all three games.
export const pb = new PocketBase(url);

export type GameId = "ae" | "mm2" | "gtd";

export const GAMES: Record<GameId, { label: string; short: string; accent: string }> = {
  ae: { label: "Anime Expeditions", short: "AE", accent: "from-fuchsia-500 to-purple-700" },
  mm2: { label: "Murder Mystery 2", short: "MM2", accent: "from-red-500 to-red-800" },
  gtd: { label: "Garden Tower Defense", short: "GTD", accent: "from-emerald-500 to-green-700" },
};

export function getEnabledGames(): GameId[] {
  const raw = pb.authStore.record?.enabled_games;
  if (!Array.isArray(raw)) return [];
  return raw.filter((g): g is GameId => g === "ae" || g === "mm2" || g === "gtd");
}

export async function setEnabledGames(games: GameId[]): Promise<void> {
  const id = pb.authStore.record?.id;
  if (!id) throw new Error("not signed in");
  await pb.collection("users").update(id, { enabled_games: games });
}
