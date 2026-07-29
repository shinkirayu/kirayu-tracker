/** Row shapes mirror mm2-server/pb_migrations/*_create_accounts.js. */

/** One owned item, enriched by the tracker from the game's own item catalog. */
export interface ItemEntry {
  Key: string;
  Name: string;
  /** Only present on Weapons entries — "Knife" | "Gun" | "Misc". */
  ItemType?: string;
  Rarity?: string;
  /** Roblox asset id / url, resolved through the asset-icon proxy. */
  Image?: string;
  Quantity: number;
  Equipped: boolean;
  /** Materials entries only — flags a rotating event currency (e.g. "Shells") vs. a plain crafting material. */
  Currency?: boolean;
}

export type ItemCategory = "weapons" | "pets" | "effects" | "toys" | "emotes" | "radios" | "materials";

export const ITEM_CATEGORIES: { key: ItemCategory; label: string }[] = [
  { key: "weapons", label: "Weapons" },
  { key: "pets", label: "Pets" },
  { key: "effects", label: "Effects" },
  { key: "toys", label: "Toys" },
  { key: "emotes", label: "Emotes" },
  { key: "radios", label: "Radios" },
  { key: "materials", label: "Materials" },
];

/** Light list row — only the columns in ACCOUNT_LIST_COLUMNS are fetched. */
export interface AccountListRow {
  user_id: number;
  username: string;
  display_name: string | null;
  level: number | null;
  prestige: number;
  coins: number | null;
  /** Seashells — the current rotating event currency (Materials entry flagged Currency=true). */
  shells: number | null;
  xp: number | null;
  next_level_xp: number | null;
  level_progress: number | null;
  in_round: boolean;
  role: string | null;
  map: string | null;
  gamemode: string | null;
  weapon_count: number;
  pet_count: number;
  effect_count: number;
  toy_count: number;
  emote_count: number;
  radio_count: number;
  material_count: number;
  item_count: number;
  last_seen: string;
}

/** Full light row, fetched on the detail page. */
export interface AccountRow extends AccountListRow {
  first_seen: string;
  updated_at: string;
}

/** Heavy 1:1 row — lazily fetched only on the detail page. */
export interface AccountDetailsRow {
  user_id: number;
  weapons: ItemEntry[];
  pets: ItemEntry[];
  effects: ItemEntry[];
  toys: ItemEntry[];
  emotes: ItemEntry[];
  radios: ItemEntry[];
  materials: ItemEntry[];
  updated_at: string;
}

export interface DashboardStats {
  total: number;
  online: number;
  in_round: number;
  avg_level: number;
  max_level: number;
}

export type SortKey = "last_seen" | "level" | "coins" | "shells" | "xp" | "username";

export interface AccountFilters {
  search: string;
  sort: SortKey;
  onlineOnly: boolean;
  inRoundOnly: boolean;
}

/** Column list for the account grid — never SELECT * on the hot path. */
export const ACCOUNT_LIST_COLUMNS =
  "user_id,username,display_name,level,prestige,coins,shells,xp,next_level_xp,level_progress," +
  "in_round,role,map,gamemode,weapon_count,pet_count,effect_count,toy_count,emote_count," +
  "radio_count,material_count,item_count,last_seen";

export const PAGE_SIZE = 30;

/** An account is "online" if the tracker reported within this window. */
export const ONLINE_WINDOW_MS = 3 * 60 * 1000;

export function isOnline(lastSeen: string): boolean {
  return Date.now() - new Date(lastSeen).getTime() < ONLINE_WINDOW_MS;
}

/**
 * PocketBase stores "date" fields as "YYYY-MM-DD HH:MM:SS.SSSZ" (space, not
 * "T") and compares filter operands against that literally rather than
 * re-parsing them — a plain `.toISOString()` cutoff silently matches nothing
 * (it always sorts after every real value). Use this wherever a date is
 * bound into a `pb.filter(...)` string.
 */
export function pbDateString(date: Date): string {
  return date.toISOString().replace("T", " ");
}

/**
 * Real in-game rarity tiers, colors, and sort order — read directly out of
 * a live client's ReplicatedStorage.Database.Sync.Rarities. Lower `sort` is
 * more prestigious; seasonal rarities (Halloween/Christmas/Classic) sort
 * after the evergreen ones.
 */
export const RARITIES: { name: string; hex: string; sort: number }[] = [
  { name: "Unique", hex: "#fa8c00", sort: 70 },
  { name: "Ancient", hex: "#640aff", sort: 75 },
  { name: "Godly", hex: "#ff00b3", sort: 80 },
  { name: "Legendary", hex: "#dc0005", sort: 85 },
  { name: "Rare", hex: "#00c800", sort: 90 },
  { name: "Uncommon", hex: "#00ffff", sort: 95 },
  { name: "Common", hex: "#6a6a6a", sort: 100 },
  { name: "Halloween", hex: "#b44600", sort: 104 },
  { name: "Christmas", hex: "#1ec3be", sort: 105 },
  { name: "Classic", hex: "#e6c800", sort: 110 },
];

/** Best-to-worst rarity order — used for "sort by rarity" everywhere. */
export const RARITY_ORDER = RARITIES.slice()
  .sort((a, b) => a.sort - b.sort)
  .map((r) => r.name);

/** Index into RARITY_ORDER, unknown/absent rarities sort last. */
export function rarityRank(rarity: string | undefined): number {
  const i = rarity ? RARITY_ORDER.indexOf(rarity) : -1;
  return i === -1 ? RARITY_ORDER.length : i;
}
