import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useAllItems, type AggregatedItem, type OwnedItem } from "../hooks/useAllItems";
import { useDeleteAccounts } from "../hooks/useDeleteAccounts";
import { ITEM_CATEGORIES, RARITY_ORDER, type ItemCategory } from "../lib/types";
import { rarityBoxStyle, rarityHex } from "../lib/format";
import { wikiItemIconCandidates } from "../lib/itemImages";
import { AssetImage } from "../components/AssetImage";
import { CloseButton } from "../components/CloseButton";
import { BagIcon, EffectIcon, EmoteIcon, KnifeIcon, MaskIcon, PawIcon, RadioIcon } from "../components/icons";

const CATEGORY_ICONS: Record<ItemCategory, (p: { className?: string }) => React.ReactElement> = {
  weapons: KnifeIcon,
  pets: PawIcon,
  effects: EffectIcon,
  toys: MaskIcon,
  emotes: EmoteIcon,
  radios: RadioIcon,
  materials: BagIcon,
};

export default function ItemsPage() {
  const [category, setCategory] = useState<ItemCategory>("weapons");
  const [weaponType, setWeaponType] = useState<"all" | "Knife" | "Gun">("all");
  const [rarityFilter, setRarityFilter] = useState<string | null>(null);
  const [selected, setSelected] = useState<AggregatedItem | null>(null);

  const { data: items, isLoading, isError } = useAllItems(category);

  const filtered = useMemo(() => {
    let list = items ?? [];
    if (category === "weapons" && weaponType !== "all") {
      list = list.filter((i) => i.itemType === weaponType);
    }
    if (rarityFilter) list = list.filter((i) => i.rarity === rarityFilter);
    return list.slice().sort((a, b) => {
      const ai = RARITY_ORDER.indexOf(a.rarity ?? "");
      const bi = RARITY_ORDER.indexOf(b.rarity ?? "");
      const rarityDiff = (ai === -1 ? 999 : ai) - (bi === -1 ? 999 : bi);
      return rarityDiff !== 0 ? rarityDiff : a.name.localeCompare(b.name);
    });
  }, [items, category, weaponType, rarityFilter]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-lg font-semibold tracking-tight">Items</h1>
        <p className="text-sm text-zinc-500 dark:text-zinc-400">
          Every item across all of your tracked accounts. Click one to see who has it.
        </p>
      </div>

      <div className="flex flex-wrap gap-1.5">
        {ITEM_CATEGORIES.map(({ key, label }) => {
          const Icon = CATEGORY_ICONS[key];
          const isActive = key === category;
          return (
            <button
              key={key}
              onClick={() => {
                setCategory(key);
                setWeaponType("all");
                setRarityFilter(null);
              }}
              className={`font-display flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-semibold transition-colors ${
                isActive
                  ? "gradient-blood border-transparent text-white shadow-[0_0_10px_rgba(165,0,8,0.4)]"
                  : "border-zinc-200 text-zinc-600 hover:bg-zinc-100 dark:border-zinc-700 dark:text-zinc-400 dark:hover:bg-white/5"
              }`}
            >
              <Icon className="size-3.5" />
              {label}
            </button>
          );
        })}
      </div>

      {category === "weapons" && (
        <div className="flex gap-1.5">
          {(["all", "Knife", "Gun"] as const).map((t) => (
            <button
              key={t}
              onClick={() => setWeaponType(t)}
              className={`rounded-md border px-2.5 py-1 text-xs font-semibold transition-colors ${
                weaponType === t
                  ? "border-zinc-900 bg-zinc-900 text-white dark:border-white dark:bg-white dark:text-zinc-900"
                  : "border-zinc-200 text-zinc-500 hover:border-zinc-300 dark:border-white/10 dark:text-zinc-400 dark:hover:border-white/25"
              }`}
            >
              {t === "all" ? "All" : `${t}s`}
            </button>
          ))}
        </div>
      )}

      <div className="flex flex-wrap justify-end gap-1.5">
        <button
          onClick={() => setRarityFilter(null)}
          className={`rounded-md border px-3 py-1 text-xs font-semibold transition-colors ${
            rarityFilter === null
              ? "border-zinc-900 bg-zinc-900 text-white dark:border-white dark:bg-white dark:text-zinc-900"
              : "border-zinc-200 text-zinc-500 hover:border-zinc-300 dark:border-white/10 dark:text-zinc-400 dark:hover:border-white/25"
          }`}
        >
          All
        </button>
        {RARITY_ORDER.map((r) => (
          <button
            key={r}
            onClick={() => setRarityFilter((cur) => (cur === r ? null : r))}
            style={rarityBoxStyle(r)}
            className={`font-display text-outline rounded-md px-3 py-1 text-xs font-bold text-white transition-all ${
              rarityFilter === r ? "scale-105 opacity-100 ring-2 ring-white/90" : "opacity-60 hover:opacity-90"
            }`}
          >
            {r}
          </button>
        ))}
      </div>

      {isError && (
        <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800 dark:border-red-900 dark:bg-red-500/10 dark:text-red-300">
          Failed to load items.
        </div>
      )}

      {isLoading ? (
        <div className="grid grid-cols-3 gap-2.5 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-8 xl:grid-cols-10">
          {Array.from({ length: 10 }, (_, i) => (
            <div
              key={i}
              className="aspect-square animate-pulse rounded-xl border border-zinc-200/80 bg-white shadow-sm dark:border-red-500/10 dark:bg-white/[0.03]"
            />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-zinc-300 p-12 text-center text-sm text-zinc-500 dark:border-red-500/15">
          No items yet.
        </div>
      ) : (
        <div className="grid grid-cols-3 gap-2.5 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-8 xl:grid-cols-10">
          {filtered.map((item) => (
            <button
              key={item.key}
              onClick={() => setSelected(item)}
              style={rarityBoxStyle(item.rarity)}
              className="relative flex aspect-square flex-col overflow-hidden rounded-[11px] p-1.5 text-left transition-transform hover:scale-[1.05]"
            >
              <span className="font-display absolute top-1 left-1 z-10 rounded bg-black/50 px-1 py-0.5 text-[10px] leading-none font-bold text-white">
                {item.owners.length}
              </span>
              <AssetImage
                srcCandidates={wikiItemIconCandidates(item.name, item.itemType)}
                rbxAssetId={item.image}
                alt={item.name}
                className="absolute inset-0 h-full w-full object-contain p-3"
                fallback={<span className="absolute inset-0 flex items-center justify-center text-3xl">🔪</span>}
              />
              <div className="relative mt-auto w-full bg-gradient-to-t from-black/80 to-transparent text-center">
                <div className="font-display text-outline truncate text-[11px] font-semibold">{item.name}</div>
                <div className="truncate text-[8px] font-semibold" style={{ color: rarityHex(item.rarity) }}>
                  {item.rarity ?? "Unknown"}
                </div>
              </div>
            </button>
          ))}
        </div>
      )}

      {selected && <ItemOwnersModal item={selected} onClose={() => setSelected(null)} />}
    </div>
  );
}

interface GroupedOwner {
  key: string;
  account: OwnedItem;
  count: number;
  equippedAny: boolean;
}

/** Same account can own several copies of this item — combine into one row. */
function groupOwners(owners: OwnedItem[]): GroupedOwner[] {
  const map = new Map<string, GroupedOwner>();
  for (const o of owners) {
    const existing = map.get(String(o.user_id));
    if (existing) {
      existing.count += o.Quantity;
      if (o.Equipped) existing.equippedAny = true;
    } else {
      map.set(String(o.user_id), { key: String(o.user_id), account: o, count: o.Quantity, equippedAny: o.Equipped });
    }
  }
  return Array.from(map.values());
}

function ItemOwnersModal({ item, onClose }: { item: AggregatedItem; onClose: () => void }) {
  const [removedIds, setRemovedIds] = useState<Set<number>>(new Set());
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [copied, setCopied] = useState(false);
  const deleteAccounts = useDeleteAccounts();

  const activeOwners = useMemo(() => item.owners.filter((o) => !removedIds.has(o.user_id)), [item.owners, removedIds]);
  const groupedOwners = useMemo(() => groupOwners(activeOwners), [activeOwners]);
  const usernameByUserId = useMemo(() => {
    const map = new Map<number, string>();
    for (const o of activeOwners) if (!map.has(o.user_id)) map.set(o.user_id, o.username);
    return map;
  }, [activeOwners]);

  function toggleOne(userId: number) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(userId)) next.delete(userId);
      else next.add(userId);
      return next;
    });
  }

  function handleCopy() {
    const names = [...selected].map((id) => usernameByUserId.get(id)).filter((n): n is string => !!n);
    if (names.length === 0) return;
    navigator.clipboard.writeText(names.join("\n"));
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }

  function handleDelete() {
    const ids = [...selected];
    const names = ids.map((id) => usernameByUserId.get(id)).filter((n): n is string => !!n);
    const ok = window.confirm(
      `Stop tracking ${ids.length} account${ids.length > 1 ? "s" : ""}?\n\n${names.join(", ")}\n\nThis removes them from the dashboard entirely and cannot be undone.`,
    );
    if (!ok) return;
    deleteAccounts.mutate(ids, {
      onSuccess: () => {
        setRemovedIds((prev) => new Set([...prev, ...ids]));
        setSelected(new Set());
      },
    });
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <div
        className="max-h-[80vh] w-full max-w-lg overflow-hidden rounded-2xl border border-zinc-200 bg-white shadow-xl dark:border-red-500/15 dark:bg-[#150a0d]"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-zinc-200 p-4 dark:border-red-500/10">
          <div className="flex items-center gap-3">
            <div style={rarityBoxStyle(item.rarity)} className="relative size-12 shrink-0 overflow-hidden rounded-[11px]">
              <AssetImage
                srcCandidates={wikiItemIconCandidates(item.name, item.itemType)}
                rbxAssetId={item.image}
                alt={item.name}
                className="absolute inset-0 h-full w-full object-contain p-1.5"
              />
            </div>
            <div>
              <h2 className="font-display font-semibold">{item.name}</h2>
              <p className="text-xs font-medium" style={{ color: rarityHex(item.rarity) }}>
                {item.rarity ?? "Unknown"} · {new Set(activeOwners.map((o) => o.user_id)).size} accounts
              </p>
            </div>
          </div>
          <CloseButton onClick={onClose} />
        </div>

        {selected.size > 0 && (
          <div className="flex items-center justify-between gap-2 border-b border-red-200 bg-red-50 px-4 py-2 dark:border-red-500/15 dark:bg-red-500/10">
            <span className="text-xs font-semibold text-red-700 dark:text-red-300">{selected.size} selected</span>
            <div className="flex items-center gap-1.5">
              <button
                onClick={handleCopy}
                className="rounded-md border border-zinc-200 bg-white px-2 py-1 text-[11px] font-semibold text-zinc-600 transition-colors hover:border-red-400 dark:border-white/10 dark:bg-white/5 dark:text-zinc-300"
              >
                {copied ? "Copied!" : "Copy usernames"}
              </button>
              <button
                onClick={handleDelete}
                disabled={deleteAccounts.isPending}
                className="rounded-md border border-red-200 bg-white px-2 py-1 text-[11px] font-semibold text-red-600 transition-colors hover:border-red-400 disabled:opacity-50 dark:border-red-500/25 dark:bg-white/5 dark:text-red-400"
              >
                {deleteAccounts.isPending ? "Deleting…" : "Delete"}
              </button>
              <button
                onClick={() => setSelected(new Set())}
                className="rounded-md border border-zinc-200 bg-white px-2 py-1 text-[11px] font-semibold text-zinc-600 transition-colors hover:border-zinc-300 dark:border-white/10 dark:bg-white/5 dark:text-zinc-300"
              >
                Clear
              </button>
            </div>
          </div>
        )}

        <div className="max-h-[60vh] space-y-2 overflow-y-auto p-3">
          {groupedOwners.length === 0 ? (
            <p className="p-4 text-center text-sm text-zinc-500 dark:text-zinc-400">No accounts left.</p>
          ) : (
            groupedOwners.map(({ key, account: o, count, equippedAny }) => (
              <Link
                key={key}
                to={`/mm2/account/${o.user_id}`}
                className={`flex items-center justify-between gap-2 rounded-lg border px-3 py-2 text-sm transition-colors ${
                  selected.has(o.user_id)
                    ? "border-red-400 bg-red-50 dark:border-red-500/60 dark:bg-red-500/10"
                    : "border-zinc-200 bg-zinc-50 hover:border-red-400 dark:border-white/5 dark:bg-white/[0.04] dark:hover:border-red-500/50"
                }`}
              >
                <span className="flex min-w-0 items-center gap-2">
                  <input
                    type="checkbox"
                    checked={selected.has(o.user_id)}
                    onClick={(e) => e.stopPropagation()}
                    onChange={() => toggleOne(o.user_id)}
                    className="size-3.5 shrink-0 accent-red-600"
                    aria-label={`Select ${o.username}`}
                  />
                  <span className="truncate font-medium">{o.display_name || o.username}</span>
                </span>
                <span className="ml-2 shrink-0 text-xs text-zinc-500 dark:text-zinc-400">
                  {equippedAny ? "equipped " : ""}
                  {count > 1 ? `×${count}` : ""}
                </span>
              </Link>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
