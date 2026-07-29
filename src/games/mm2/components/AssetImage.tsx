import { useState, type ReactNode } from "react";
import { assetIconUrl } from "../lib/assetIcon";

/**
 * Real image via one of several candidate URLs, tried in order, falling back
 * to `fallback` once every candidate has failed to load. `srcCandidates`
 * (e.g. wiki icon guesses) are tried before the Roblox asset-icon proxy.
 */
export function AssetImage({
  rbxAssetId,
  src: srcOverride,
  srcCandidates,
  alt,
  className = "size-4 shrink-0 object-contain",
  fallback = null,
}: {
  rbxAssetId?: string | null;
  /** Single direct image URL, tried before `rbxAssetId`. */
  src?: string | null;
  /** Ordered list of direct image URLs to try before `rbxAssetId` — first one that loads wins. */
  srcCandidates?: (string | null | undefined)[];
  alt: string;
  className?: string;
  fallback?: ReactNode;
}) {
  const candidates = [srcOverride, ...(srcCandidates ?? []), assetIconUrl(rbxAssetId)].filter(
    (s): s is string => !!s,
  );
  const [index, setIndex] = useState(0);

  const src = candidates[index];
  if (!src) return <>{fallback}</>;
  return (
    <img
      src={src}
      alt={alt}
      className={`inline-block ${className}`}
      loading="lazy"
      onError={() => setIndex((i) => i + 1)}
    />
  );
}
