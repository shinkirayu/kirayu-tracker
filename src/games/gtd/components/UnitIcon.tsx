import { useState } from "react";
import { githubCdnUrl, useUnitIcon } from "../hooks/useUnitIcon";

/**
 * Icon resolution cascade (mirrors the original dashboard's AssetImage
 * logic): 1) the account's own rbxassetid:// image, resolved to a real CDN
 * URL via the roblox-thumb proxy — the exact icon the game itself uses, not
 * a guessed filename; 2) the GTDCDN GitHub mirror, keyed by unit id; 3) an
 * emoji as the last resort.
 */
export function UnitIcon({
  image,
  rawName,
  emoji = "📦",
  className,
}: {
  image: string | null | undefined;
  rawName: string | null | undefined;
  emoji?: string;
  className?: string;
}) {
  const resolved = useUnitIcon(image);
  const fallback = githubCdnUrl(rawName);
  const [stage, setStage] = useState<"resolved" | "fallback" | "emoji">("resolved");

  const src = stage === "resolved" ? resolved || fallback : stage === "fallback" ? fallback : null;

  if (!src) {
    return <span className={`unit-fallback-emoji ${className ?? ""}`}>{emoji}</span>;
  }

  return (
    <img
      className={`unit-icon-img ${className ?? ""}`}
      src={src}
      alt=""
      onError={() => setStage((s) => (s === "resolved" && fallback ? "fallback" : "emoji"))}
    />
  );
}
