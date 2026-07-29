import type { AccountFilters, SortKey } from "../lib/types";
import type { ColumnPrefs } from "../lib/columnPrefs";
import { SearchIcon } from "./icons";
import { Dropdown } from "./Dropdown";
import { ColumnsMenu } from "./ColumnsMenu";

const SORTS: { value: SortKey; label: string }[] = [
  { value: "last_seen", label: "Last seen" },
  { value: "level", label: "Level" },
  { value: "coins", label: "Coins" },
  { value: "shells", label: "Seashells" },
  { value: "xp", label: "XP" },
  { value: "username", label: "Name" },
];

interface Props {
  searchInput: string;
  onSearchInput: (v: string) => void;
  filters: AccountFilters;
  onFilters: (f: AccountFilters) => void;
  onClear: () => void;
  /** Rows currently loaded into the list — not a total match count (the app deliberately avoids COUNT queries). */
  loadedCount: number;
  columns: ColumnPrefs;
  onColumns: (next: ColumnPrefs) => void;
}

export function FilterBar({
  searchInput,
  onSearchInput,
  filters,
  onFilters,
  onClear,
  loadedCount,
  columns,
  onColumns,
}: Props) {
  const chip = (active: boolean) =>
    `rounded-full border px-3 py-1.5 text-xs font-semibold transition-colors ${
      active
        ? "gradient-blood border-transparent text-white shadow-[0_0_10px_rgba(165,0,8,0.45)]"
        : "border-zinc-200 text-zinc-600 hover:bg-zinc-100 dark:border-zinc-700 dark:text-zinc-400 dark:hover:bg-white/5"
    }`;

  const hasActiveFilters = filters.onlineOnly || filters.inRoundOnly || searchInput.trim().length > 0;

  return (
    <div className="flex flex-col gap-3 rounded-2xl border border-zinc-200/80 bg-white p-3 shadow-sm sm:flex-row sm:items-center dark:border-red-500/10 dark:bg-white/[0.03]">
      <div className="relative w-full sm:max-w-xs">
        <SearchIcon className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-zinc-400" />
        <input
          type="search"
          value={searchInput}
          onChange={(e) => onSearchInput(e.target.value)}
          placeholder="Search username…"
          aria-label="Search accounts"
          className="w-full rounded-lg border border-zinc-200 bg-transparent py-2 pr-3 pl-9 text-sm outline-none focus:border-red-400 dark:border-zinc-700"
        />
      </div>
      <div className="flex flex-wrap items-center gap-2 sm:ml-auto">
        <span className="text-xs text-zinc-400 dark:text-zinc-500" aria-live="polite">
          {loadedCount} loaded
        </span>
        <button
          className={chip(filters.onlineOnly)}
          onClick={() => onFilters({ ...filters, onlineOnly: !filters.onlineOnly })}
        >
          Online only
        </button>
        <button
          className={chip(filters.inRoundOnly)}
          onClick={() => onFilters({ ...filters, inRoundOnly: !filters.inRoundOnly })}
        >
          In round
        </button>
        <Dropdown<SortKey>
          value={filters.sort}
          options={SORTS}
          onChange={(sort) => onFilters({ ...filters, sort })}
          label="Sort"
          ariaLabel="Sort accounts"
        />
        <ColumnsMenu prefs={columns} onChange={onColumns} />
        {hasActiveFilters && (
          <button
            onClick={onClear}
            className="text-xs font-medium text-red-600 hover:underline dark:text-red-400"
          >
            Clear
          </button>
        )}
      </div>
    </div>
  );
}
