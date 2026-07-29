import { useMemo, useState } from "react";
import type { AccountDetailsRow, ItemEntry } from "../lib/types";
import { RARITY_ORDER, rarityRank } from "../lib/types";
import { estimateValue, fmtFullNum } from "../lib/format";
import { BagIcon, EffectIcon, EmoteIcon, GunIcon, KnifeIcon, MaskIcon, PawIcon, RadioIcon, SearchIcon } from "./icons";
import { Dropdown } from "./Dropdown";
import { ItemCard } from "./ItemCard";

type TabKey = "knives" | "guns" | "pets" | "effects" | "toys" | "emotes" | "radios" | "materials";
type SortMode = "rarity" | "value" | "name" | "quantity";

const TAB_ICONS: Record<TabKey, (p: { className?: string }) => React.ReactElement> = {
  knives: KnifeIcon,
  guns: GunIcon,
  pets: PawIcon,
  effects: EffectIcon,
  toys: MaskIcon,
  emotes: EmoteIcon,
  radios: RadioIcon,
  materials: BagIcon,
};

function buildTabs(details: AccountDetailsRow | null | undefined): { key: TabKey; label: string; items: ItemEntry[] }[] {
  const weapons = details?.weapons ?? [];
  return [
    { key: "knives", label: "Knives", items: weapons.filter((w) => w.ItemType === "Knife") },
    { key: "guns", label: "Guns", items: weapons.filter((w) => w.ItemType === "Gun") },
    { key: "pets", label: "Pets", items: details?.pets ?? [] },
    { key: "effects", label: "Effects", items: details?.effects ?? [] },
    { key: "toys", label: "Toys", items: details?.toys ?? [] },
    { key: "emotes", label: "Emotes", items: details?.emotes ?? [] },
    { key: "radios", label: "Radios", items: details?.radios ?? [] },
    { key: "materials", label: "Materials", items: details?.materials ?? [] },
  ];
}

export function InventoryPanel({
  details,
  isLoading,
  valueOverrides,
  onSetValue,
}: {
  details: AccountDetailsRow | null | undefined;
  isLoading: boolean;
  valueOverrides: Record<string, number>;
  onSetValue: (itemKey: string, value: number | null) => void;
}) {
  const tabs = useMemo(() => buildTabs(details), [details]);
  const [activeTab, setActiveTab] = useState<TabKey>("knives");
  const [search, setSearch] = useState("");
  const [rarityFilter, setRarityFilter] = useState<string>("all");
  const [sort, setSort] = useState<SortMode>("rarity");

  const active = tabs.find((t) => t.key === activeTab) ?? tabs[0];

  const rarityOptions = useMemo(() => {
    const present = new Set(active.items.map((i) => i.Rarity).filter(Boolean) as string[]);
    return ["all", ...RARITY_ORDER.filter((r) => present.has(r))];
  }, [active.items]);

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    let items = active.items;
    if (term) items = items.filter((i) => i.Name.toLowerCase().includes(term));
    if (rarityFilter !== "all") items = items.filter((i) => i.Rarity === rarityFilter);
    return items.slice().sort((a, b) => {
      switch (sort) {
        case "value":
          return (valueOverrides[b.Key] ?? -1) - (valueOverrides[a.Key] ?? -1);
        case "name":
          return a.Name.localeCompare(b.Name);
        case "quantity":
          return b.Quantity - a.Quantity;
        default:
          return rarityRank(a.Rarity) - rarityRank(b.Rarity);
      }
    });
  }, [active.items, search, rarityFilter, sort, valueOverrides]);

  const tabValue = useMemo(() => estimateValue(active.items, valueOverrides), [active.items, valueOverrides]);

  if (isLoading) {
    return <div className="animate-pulse rounded-xl bg-zinc-100 p-16 dark:bg-zinc-900" />;
  }

  return (
    <div>
      <div className="mb-4 flex flex-wrap gap-1.5">
        {tabs.map((t) => {
          const Icon = TAB_ICONS[t.key];
          const isActive = t.key === activeTab;
          return (
            <button
              key={t.key}
              onClick={() => setActiveTab(t.key)}
              className={`font-display flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-semibold transition-colors ${
                isActive
                  ? "gradient-blood border-transparent text-white shadow-[0_0_10px_rgba(165,0,8,0.4)]"
                  : "border-zinc-200 text-zinc-600 hover:bg-zinc-100 dark:border-zinc-700 dark:text-zinc-400 dark:hover:bg-white/5"
              }`}
            >
              <Icon className="size-3.5" />
              {t.label}
              <span className="tabular-nums opacity-70">{t.items.length}</span>
            </button>
          );
        })}
      </div>

      <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-center">
        <div className="relative w-full sm:max-w-xs">
          <SearchIcon className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-zinc-400" />
          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={`Search ${active.label.toLowerCase()}…`}
            className="w-full rounded-lg border border-zinc-200 bg-transparent py-1.5 pr-3 pl-9 text-sm outline-none focus:border-red-400 dark:border-zinc-700"
          />
        </div>
        <div className="flex flex-wrap items-center gap-2 sm:ml-auto">
          <Dropdown
            value={rarityFilter}
            options={rarityOptions.map((r) => ({ value: r, label: r === "all" ? "All rarities" : r }))}
            onChange={setRarityFilter}
            label="Rarity"
            ariaLabel="Filter by rarity"
          />
          <Dropdown<SortMode>
            value={sort}
            options={[
              { value: "rarity", label: "Rarity" },
              { value: "value", label: "Value" },
              { value: "name", label: "Name" },
              { value: "quantity", label: "Quantity" },
            ]}
            onChange={setSort}
            label="Sort"
            ariaLabel="Sort items"
          />
          <span className="text-xs font-semibold text-amber-600 dark:text-amber-400">
            Est. value: {fmtFullNum(tabValue)}
          </span>
        </div>
      </div>

      {filtered.length === 0 ? (
        <p className="py-8 text-center text-sm text-zinc-400">No {active.label.toLowerCase()} match.</p>
      ) : (
        <div className="grid grid-cols-3 gap-3 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-8">
          {filtered.map((item) => (
            <ItemCard
              key={item.Key}
              item={item}
              value={valueOverrides[item.Key] ?? null}
              onSetValue={(v) => onSetValue(item.Key, v)}
            />
          ))}
        </div>
      )}
    </div>
  );
}

/** Sum of every category's estimated value — used for the account header's "Est. total value" tile. */
export function estimateAccountValue(details: AccountDetailsRow | null | undefined, overrides: Record<string, number>): number {
  if (!details) return 0;
  return (
    estimateValue(details.weapons ?? [], overrides) +
    estimateValue(details.pets ?? [], overrides) +
    estimateValue(details.effects ?? [], overrides) +
    estimateValue(details.toys ?? [], overrides) +
    estimateValue(details.emotes ?? [], overrides) +
    estimateValue(details.radios ?? [], overrides) +
    estimateValue(details.materials ?? [], overrides)
  );
}
