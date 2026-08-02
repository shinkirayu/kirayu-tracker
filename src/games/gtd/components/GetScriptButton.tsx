import { useEffect, useRef, useState } from "react";
import { buildTrackerScript } from "../lib/trackerScript";
import { buildCombinedScript } from "../lib/combinedScript";
import { buildLobbyParkerScript } from "../lib/lobbyParkerScript";
import { useToast } from "../../../components/Toast";

interface ScriptOption {
  label: string;
  hint: string;
  build: () => string;
  toast: string;
}

const SCRIPTS: ScriptOption[] = [
  {
    label: "Kaitun (all-in-one: farm + trade + summon + buy + lobby shop)",
    hint: "Full headless farm bot - maps, macro, auto-restart, tracker sync, trading, gacha summon looping, auto-buy, and an always-on lobby permanent-shop buyer. Replaces running Kaitun and Summon/Buy separately.",
    build: buildCombinedScript,
    toast: "Paste it into your Roblox executor while Garden Tower Defense is open, then run it.",
  },
  {
    label: "Lobby Parker",
    hint: "Dedicated trade-meeting-point accounts only - don't run with Kaitun on the same account.",
    build: buildLobbyParkerScript,
    toast: "Paste it into your Roblox executor on a dedicated parked account, then run it.",
  },
  {
    label: "Tracker only",
    hint: "Read-only: reports inventory/seeds, no farming or automation.",
    build: buildTrackerScript,
    toast: "Paste it into your Roblox executor while Garden Tower Defense is open, then run it.",
  },
];

/** Header button: pick which GTD script to copy to the clipboard. */
export function GetScriptButton() {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const toast = useToast();

  useEffect(() => {
    if (!open) return;
    const onDocClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("mousedown", onDocClick);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDocClick);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  async function copy(option: ScriptOption) {
    await navigator.clipboard.writeText(option.build());
    toast.success("Copied!", option.toast);
    setOpen(false);
  }

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen((o) => !o)}
        className={`nav-tab pill ${open ? "yellow" : "grey"} rounded-full px-3.5 py-1.5 text-sm font-medium transition-colors`}
      >
        Get script
      </button>
      {open && (
        <div
          className="absolute top-full right-0 z-20 mt-1 w-72 overflow-hidden rounded-lg border py-1 shadow-lg"
          style={{ background: "var(--panel, #18181b)", borderColor: "var(--panel-border, rgba(255, 255, 255, 0.1))" }}
        >
          {SCRIPTS.map((option) => (
            <button
              key={option.label}
              onClick={() => copy(option)}
              className="block w-full px-3 py-2 text-left transition-colors hover:brightness-125"
            >
              <div className="text-sm font-medium" style={{ color: "var(--text, #f4f4f5)" }}>
                {option.label}
              </div>
              <div className="text-xs" style={{ color: "var(--text-dim, #a1a1aa)" }}>
                {option.hint}
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
