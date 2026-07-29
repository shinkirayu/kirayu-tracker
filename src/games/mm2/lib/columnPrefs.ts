/**
 * Which optional dashboard columns/buttons are visible — saved in this
 * browser's localStorage so the choice survives reloads. "Optional" means
 * everything except the Account/Level/Last-update columns, which are always
 * shown.
 */

export type ColumnKey =
  | "coins"
  | "shells"
  | "prestige"
  | "xp"
  | "weapons"
  | "pets"
  | "effects"
  | "toys"
  | "emotes"
  | "radios"
  | "materials"
  | "presence";

export const COLUMN_LABELS: Record<ColumnKey, string> = {
  coins: "Coins",
  shells: "Seashells",
  prestige: "Prestige",
  xp: "XP",
  weapons: "Weapons",
  pets: "Pets",
  effects: "Effects",
  toys: "Toys",
  emotes: "Emotes",
  radios: "Radios",
  materials: "Materials",
  presence: "Round / Role",
};

export const ALL_COLUMNS = Object.keys(COLUMN_LABELS) as ColumnKey[];

export type ColumnPrefs = Record<ColumnKey, boolean>;

const STORAGE_KEY = "mm2-dashboard-columns";

function defaults(): ColumnPrefs {
  return Object.fromEntries(ALL_COLUMNS.map((k) => [k, true])) as ColumnPrefs;
}

export function loadColumnPrefs(): ColumnPrefs {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return defaults();
    const saved = JSON.parse(raw);
    return { ...defaults(), ...saved };
  } catch {
    return defaults();
  }
}

export function saveColumnPrefs(prefs: ColumnPrefs): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(prefs));
  } catch {
    /* private mode */
  }
}
