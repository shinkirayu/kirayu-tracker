import { assetIconUrl } from "./assetIcon";
import { MM2_ITEM_ICONS } from "./mm2ItemIcons.generated";

/**
 * Item pictures, resolved in two tiers:
 *
 * 1. `MM2_ITEM_ICONS` — real Roblox asset ids pulled directly from the live
 *    game's own item catalog (ReplicatedStorage.Database.Sync.{Item,Pets,
 *    Toys,Emotes,Radios,Materials,Effects}) via the roblox-executor MCP, one
 *    generated snapshot (see mm2ItemIcons.generated.ts). Weapon entries are
 *    keyed "Name|ItemType" since the same display name can exist as both a
 *    Knife and a Gun skin; every other category is keyed by name alone.
 * 2. The Murder Mystery 2 Fandom wiki's Special:FilePath redirect, as a
 *    best-effort guess for anything added to the game after that snapshot
 *    was taken. File names on the wiki aren't perfectly consistent (some are
 *    "<Name>_knife.png", some are just "<Name>.png"), so this is a guess,
 *    not a lookup — AssetImage tries each candidate in order and falls back
 *    to the emoji icon if everything 404s.
 */
const WIKI_BASE = "https://murder-mystery-2.fandom.com/wiki/Special:FilePath/";

function filePath(filename: string): string {
  return WIKI_BASE + encodeURIComponent(filename.replace(/ /g, "_"));
}

/** Weapons carry a Knife/Gun/Misc type suffix on most wiki file names. */
const WEAPON_TYPE_SUFFIX: Record<string, string> = {
  Knife: "knife",
  Gun: "gun",
  Misc: "misc",
};

export function wikiItemIconCandidates(name: string, itemType?: string): string[] {
  const candidates: string[] = [];

  const knownRaw = (itemType && MM2_ITEM_ICONS[`${name}|${itemType}`]) || MM2_ITEM_ICONS[name];
  const known = knownRaw && assetIconUrl(knownRaw);
  if (known) candidates.push(known);

  const suffix = itemType && WEAPON_TYPE_SUFFIX[itemType];
  if (suffix) candidates.push(filePath(`${name}_${suffix}.png`));
  candidates.push(filePath(`${name}.png`));
  return candidates;
}
