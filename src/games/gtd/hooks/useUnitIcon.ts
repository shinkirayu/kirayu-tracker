import { useEffect, useState } from "react";

const POCKETBASE_URL = import.meta.env.VITE_POCKETBASE_URL as string;
const CACHE_KEY = "gtd-rblx-thumb-cache";

/** assetId -> resolved CDN url, or null once resolution has failed (so it's not retried every render). */
const iconCache = new Map<string, string | null>();

try {
  const saved = localStorage.getItem(CACHE_KEY);
  if (saved) {
    for (const [k, v] of Object.entries(JSON.parse(saved) as Record<string, string | null>)) {
      iconCache.set(k, v);
    }
  }
} catch {
  /* private mode */
}

function persistCache() {
  try {
    const obj: Record<string, string | null> = {};
    iconCache.forEach((v, k) => {
      obj[k] = v;
    });
    localStorage.setItem(CACHE_KEY, JSON.stringify(obj));
  } catch {
    /* private mode */
  }
}

const pendingIds = new Set<string>();
const listeners = new Set<() => void>();
let flushTimer: ReturnType<typeof setTimeout> | null = null;

// Debounced so every <UnitIcon> mounted in the same render pass (a whole grid
// of them) coalesces into as few /api/gtd/roblox-thumb calls as possible —
// Roblox's own thumbnail endpoint accepts a comma-separated ids list.
function scheduleFlush() {
  if (flushTimer) return;
  flushTimer = setTimeout(async () => {
    flushTimer = null;
    const ids = Array.from(pendingIds).filter((id) => !iconCache.has(id));
    pendingIds.clear();
    if (ids.length === 0) return;

    const CHUNK = 90;
    for (let i = 0; i < ids.length; i += CHUNK) {
      const chunk = ids.slice(i, i + CHUNK);
      try {
        const res = await fetch(`${POCKETBASE_URL}/api/gtd/roblox-thumb?ids=${chunk.join(",")}`);
        const data = await res.json();
        for (const item of data.data ?? []) {
          iconCache.set(String(item.targetId), item.state === "Completed" ? item.imageUrl : null);
        }
      } catch {
        chunk.forEach((id) => iconCache.set(id, null));
      }
    }
    persistCache();
    listeners.forEach((l) => l());
  }, 40);
}

export function extractAssetId(image: string | null | undefined): string | null {
  if (!image || !image.startsWith("rbxassetid://")) return null;
  const id = image.replace("rbxassetid://", "");
  return /^\d+$/.test(id) ? id : null;
}

export function githubCdnUrl(rawName: string | null | undefined): string | null {
  if (!rawName) return null;
  let cleanId = String(rawName).toLowerCase().trim().replace(/[-\s]+/g, "_");
  if (!cleanId.startsWith("unit_") && !cleanId.startsWith("dp_") && !cleanId.startsWith("gp_")) {
    cleanId = "unit_" + cleanId;
  }
  return `https://raw.githubusercontent.com/andero2003/GTDCDN/main/images/${cleanId}.png`;
}

/**
 * Resolves an in-game `rbxassetid://` image (as reported live by the tracker
 * script) to a real CDN url via the same-origin proxy (thumbnails.roblox.com
 * sends no CORS headers). Returns null while unresolved/unresolvable — the
 * caller falls back to the GitHub CDN mirror, then an emoji.
 */
export function useUnitIcon(image: string | null | undefined): string | null {
  const assetId = extractAssetId(image);
  const [, setTick] = useState(0);

  useEffect(() => {
    if (!assetId) return;
    const listener = () => setTick((n) => n + 1);
    listeners.add(listener);
    if (!iconCache.has(assetId)) {
      pendingIds.add(assetId);
      scheduleFlush();
    }
    return () => {
      listeners.delete(listener);
    };
  }, [assetId]);

  return assetId ? (iconCache.get(assetId) ?? null) : null;
}
