import { useState } from "react";
import type { ItemEntry } from "../lib/types";
import { fmtFullNum, rarityBoxStyle, rarityHex } from "../lib/format";
import { wikiItemIconCandidates } from "../lib/itemImages";
import { AssetImage } from "./AssetImage";

/**
 * Dark chrome item tile — rarity-tinted brushed-steel background (see
 * rarityBoxStyle), icon filling nearly the whole tile, name/quantity/
 * equipped badges floating on top. Value is editable inline when
 * `onSetValue` is provided (the account page's inventory tabs); read-only
 * elsewhere (e.g. the cross-account Items browser).
 */
export function ItemCard({
  item,
  value,
  onSetValue,
}: {
  item: ItemEntry;
  value?: number | null;
  onSetValue?: (value: number | null) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value != null ? String(value) : "");

  function commit() {
    setEditing(false);
    if (!onSetValue) return;
    const trimmed = draft.trim();
    if (trimmed === "") {
      onSetValue(null);
      return;
    }
    const n = Number(trimmed);
    onSetValue(Number.isFinite(n) ? n : null);
  }

  return (
    <div
      style={rarityBoxStyle(item.Rarity)}
      className="relative flex aspect-square flex-col overflow-hidden rounded-[11px]"
    >
      {item.Quantity !== 1 && (
        <span className="font-display absolute top-1.5 left-1.5 z-10 rounded-md bg-black/60 px-1.5 py-0.5 text-sm leading-none font-bold text-white">
          ×{fmtFullNum(item.Quantity)}
        </span>
      )}
      {item.Equipped && (
        <span
          title="Equipped"
          className="gradient-blood absolute top-1.5 right-1.5 z-10 flex size-5 items-center justify-center rounded-full text-[10px] font-bold text-white shadow-[0_0_8px_rgba(165,0,8,0.6)]"
        >
          ✓
        </span>
      )}

      <AssetImage
        srcCandidates={wikiItemIconCandidates(item.Name, item.ItemType)}
        rbxAssetId={item.Image}
        alt={item.Name}
        className="absolute inset-0 h-full w-full object-contain p-3 drop-shadow-[0_2px_4px_rgba(0,0,0,0.6)]"
        fallback={<span className="absolute inset-0 flex items-center justify-center text-5xl">🔪</span>}
      />

      <div className="relative z-10 mt-auto bg-gradient-to-t from-black/90 to-transparent px-1.5 pt-6 pb-1.5 text-center">
        <span className="font-display text-outline block truncate text-xs leading-tight font-semibold sm:text-sm">
          {item.Name}
        </span>
        {item.ItemType && (
          <span className="block text-[10px] font-medium" style={{ color: rarityHex(item.Rarity) }}>
            {item.Rarity ?? item.ItemType}
          </span>
        )}
        {onSetValue &&
          (editing ? (
            <input
              autoFocus
              type="number"
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onBlur={commit}
              onKeyDown={(e) => {
                if (e.key === "Enter") commit();
                if (e.key === "Escape") setEditing(false);
              }}
              placeholder="value"
              className="mt-1 w-full rounded bg-white/10 px-1 py-0.5 text-center text-[11px] text-white outline-none focus:bg-white/20"
            />
          ) : (
            <button
              onClick={() => {
                setDraft(value != null ? String(value) : "");
                setEditing(true);
              }}
              className="mt-1 block w-full truncate text-[11px] font-semibold text-amber-300 hover:underline"
            >
              {value != null ? fmtFullNum(value) : "set value"}
            </button>
          ))}
      </div>
    </div>
  );
}
