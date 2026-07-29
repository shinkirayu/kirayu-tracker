import type { CSSProperties } from "react";
import { ONLINE_WINDOW_MS, RARITIES, type ItemEntry } from "./types";

const compact = new Intl.NumberFormat("en", { notation: "compact", maximumFractionDigits: 1 });
const full = new Intl.NumberFormat("en");

export function fmtNum(n: number | null | undefined): string {
  if (n == null) return "—";
  return Math.abs(n) >= 10_000 ? compact.format(n) : full.format(n);
}

export function fmtFullNum(n: number | null | undefined): string {
  return n == null ? "—" : full.format(n);
}

export function timeAgo(iso: string | null | undefined): string {
  if (!iso) return "never";
  const s = Math.max(0, (Date.now() - new Date(iso).getTime()) / 1000);
  if (s < 10) return "just now";
  if (s < 60) return `${Math.floor(s)}s ago`;
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86_400) return `${Math.floor(s / 3600)}h ago`;
  return `${Math.floor(s / 86_400)}d ago`;
}

/** Explains *why* the status dot/badge shows what it shows — the online window is a fixed 3min threshold, not obvious from a bare dot. */
export function onlineStatusTitle(lastSeen: string | null | undefined, online: boolean): string {
  const windowMin = Math.round(ONLINE_WINDOW_MS / 60_000);
  return online
    ? `Online — reported ${timeAgo(lastSeen)} (shows offline after ${windowMin}m of silence)`
    : `Offline — hasn't reported in over ${windowMin}m (last seen ${timeAgo(lastSeen)})`;
}

/** Roman numeral for a Prestige level (0 = not prestiged, matches the game's own display). */
const ROMAN_NUMERALS = ["", "I", "II", "III", "IV", "V", "VI", "VII", "VIII", "IX", "X"];
export function prestigeRoman(prestige: number | null | undefined): string {
  if (!prestige || prestige < 1) return "";
  return ROMAN_NUMERALS[prestige] ?? `P${prestige}`;
}

/** Real in-game rarity hex, straight from ReplicatedStorage.Database.Sync.Rarities. */
export function rarityHex(rarity: string | undefined | null): string {
  return RARITIES.find((r) => r.name === rarity)?.hex ?? "#8a8a93";
}

/**
 * Dark, brushed-metal item-card background, generated entirely from CSS
 * gradients and tinted with the item's real rarity color — an original
 * treatment inspired by MM2's dark chrome inventory cards, not a copy of
 * any in-game texture or art asset.
 */
export function rarityBoxStyle(rarity: string | undefined | null): CSSProperties {
  const hex = rarityHex(rarity);
  return {
    backgroundImage: [
      "radial-gradient(circle at 50% 25%, rgba(255,255,255,0.12), rgba(0,0,0,0) 60%)",
      "repeating-linear-gradient(135deg, rgba(255,255,255,0.045) 0px, rgba(255,255,255,0.045) 2px, rgba(0,0,0,0.09) 2px, rgba(0,0,0,0.09) 4px)",
      `linear-gradient(160deg, ${hex}3d 0%, #17151b 55%, #0a0a0c 100%)`,
    ].join(", "),
    boxShadow: `inset 0 0 0 1px ${hex}55, 0 0 16px -4px ${hex}80`,
  };
}

export function fmtPlaytime(seconds: number | null | undefined): string {
  if (seconds == null || !Number.isFinite(seconds)) return "—";
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  return h > 0 ? `${h}h ${m}m` : `${m}m`;
}

/** "Offline" when the tracker hasn't reported recently — best-effort live round/role state otherwise. */
export function getPresenceLabel(
  presence: { in_round: boolean; role?: string | null; map?: string | null } | null | undefined,
  online: boolean,
): string {
  if (!online) return "Offline";
  if (!presence?.in_round) return "Lobby";
  const parts = [presence.map, presence.role].filter(Boolean);
  return parts.length > 0 ? parts.join(" · ") : "In a round";
}

/** Sum of quantity × manually-entered value for a list of items, using the override map keyed by item Key. */
export function estimateValue(items: ItemEntry[], overrides: Record<string, number>): number {
  let total = 0;
  for (const item of items) {
    const value = overrides[item.Key];
    if (value != null) total += value * item.Quantity;
  }
  return total;
}
