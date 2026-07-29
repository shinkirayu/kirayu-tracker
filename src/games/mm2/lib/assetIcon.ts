const POCKETBASE_URL = import.meta.env.VITE_POCKETBASE_URL as string;

/**
 * "rbxassetid://12345", a roblox.com asset/thumbnail URL, or a bare numeric
 * id -> our asset-icon proxy URL, or null if unresolvable. The `id=`/
 * `assetId=` query param is tried first — `rbxthumb://type=Asset&w=150&h=150&id=12345`
 * has smaller numbers (150) earlier in the string than the actual asset id,
 * so a plain "first digit run" match would grab the wrong one.
 */
export function assetIconUrl(rbxAssetId: string | undefined | null, size = "150x150"): string | null {
  if (!rbxAssetId) return null;
  const match = rbxAssetId.match(/(?:assetId|id)=(\d+)/i) ?? rbxAssetId.match(/(\d+)/);
  if (!match) return null;
  return `${POCKETBASE_URL}/api/mm2/asset-icon?id=${match[1]}&size=${size}`;
}
