/** Minimal line-art icons (stroke = currentColor) — no emoji, no icon library, no MM2/Roblox logos. Size via className (e.g. "size-4"). */

interface IconProps {
  className?: string;
  style?: React.CSSProperties;
}

const base = {
  viewBox: "0 0 24 24",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 1.8,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
};

export function UsersIcon({ className = "size-5" }: IconProps) {
  return (
    <svg {...base} className={className}>
      <circle cx="9" cy="8" r="3" />
      <path d="M3 20c0-3.3 2.7-6 6-6s6 2.7 6 6" />
      <circle cx="17" cy="9" r="2.5" />
      <path d="M15.5 14.2c2.5.4 4.5 2.6 4.5 5.3" />
    </svg>
  );
}

export function PulseIcon({ className = "size-5" }: IconProps) {
  return (
    <svg {...base} className={className}>
      <path d="M3 12h4l2-7 4 14 2-7h6" />
    </svg>
  );
}

export function ChevronIcon({ className = "size-3.5", open = false }: IconProps & { open?: boolean }) {
  return (
    <svg {...base} className={`${className} transition-transform ${open ? "rotate-90" : ""}`}>
      <path d="M9 6l6 6-6 6" />
    </svg>
  );
}

export function SearchIcon({ className = "size-4" }: IconProps) {
  return (
    <svg {...base} className={className}>
      <circle cx="11" cy="11" r="7" />
      <line x1="21" y1="21" x2="16.5" y2="16.5" />
    </svg>
  );
}

/** Knives tab / weapon glyph. */
export function KnifeIcon({ className = "size-5" }: IconProps) {
  return (
    <svg {...base} className={className}>
      <path d="M4 20L15 9" />
      <path d="M13 7l4-4 3 3-4 4-5 5H8v-3z" />
    </svg>
  );
}

/** Guns tab glyph. */
export function GunIcon({ className = "size-5" }: IconProps) {
  return (
    <svg {...base} className={className}>
      <path d="M3 15h9l2-3h5a1 1 0 0 1 1 1v2a1 1 0 0 1-1 1h-2v3h-3v-3H8l-2 3H3z" />
      <path d="M10 12V9h4" />
    </svg>
  );
}

/** Coins / currency glyph. */
export function CoinIcon({ className = "size-5" }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" className={className}>
      <circle cx="12" cy="12" r="9" fill="currentColor" opacity="0.18" />
      <circle cx="12" cy="12" r="9" fill="none" stroke="currentColor" strokeWidth="1.8" />
      <path d="M12 7v10M9.5 9.3c0-1.1 1.1-2 2.5-2s2.5.7 2.5 1.7-1 1.5-2.5 1.9-2.5.9-2.5 2 1.1 1.8 2.5 1.8 2.5-.7 2.5-1.7" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
    </svg>
  );
}

/** Round/danger indicator — stylized skull, evokes the murderer role without copying any logo. */
export function SkullIcon({ className = "size-5" }: IconProps) {
  return (
    <svg {...base} className={className}>
      <path d="M12 3c-4 0-7 3-7 7 0 2.4 1.2 4.2 2.5 5.4V18a1 1 0 0 0 1 1H10v2h4v-2h1.5a1 1 0 0 0 1-1v-2.6C17.8 14.2 19 12.4 19 10c0-4-3-7-7-7z" />
      <circle cx="9.5" cy="10.5" r="1.4" fill="currentColor" stroke="none" />
      <circle cx="14.5" cy="10.5" r="1.4" fill="currentColor" stroke="none" />
      <path d="M11 13.5h2" />
    </svg>
  );
}

/** Pets tab glyph — paw print. */
export function PawIcon({ className = "size-5" }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="currentColor">
      <ellipse cx="12" cy="16" rx="4.5" ry="4" />
      <ellipse cx="5.5" cy="10" rx="2" ry="2.4" />
      <ellipse cx="9.5" cy="6.5" rx="2" ry="2.6" />
      <ellipse cx="14.5" cy="6.5" rx="2" ry="2.6" />
      <ellipse cx="18.5" cy="10" rx="2" ry="2.4" />
    </svg>
  );
}

/** Radios tab glyph. */
export function RadioIcon({ className = "size-5" }: IconProps) {
  return (
    <svg {...base} className={className}>
      <rect x="4" y="9" width="16" height="11" rx="2" />
      <path d="M8 9V6a4 4 0 0 1 8 0v3" />
      <circle cx="9" cy="14.5" r="1.6" />
      <path d="M13.5 13h4M13.5 16h4" />
    </svg>
  );
}

/** Toys/Emotes glyph — theatre mask. */
export function MaskIcon({ className = "size-5" }: IconProps) {
  return (
    <svg {...base} className={className}>
      <path d="M4 6c2 2 3 2 4 1 1.5-1.5 3-1.5 4 0 1-1.5 2.5-1.5 4 0 1-.9 2-.9 4-1-1 5-3 9-8 9S5 11 4 6z" />
      <circle cx="9" cy="10.5" r="0.9" fill="currentColor" stroke="none" />
      <circle cx="15" cy="10.5" r="0.9" fill="currentColor" stroke="none" />
    </svg>
  );
}

/** Emotes tab glyph — smiling face. */
export function EmoteIcon({ className = "size-5" }: IconProps) {
  return (
    <svg {...base} className={className}>
      <circle cx="12" cy="12" r="8.5" />
      <path d="M8.5 14c1 1.3 2.2 2 3.5 2s2.5-.7 3.5-2" />
      <circle cx="9" cy="10" r="0.9" fill="currentColor" stroke="none" />
      <circle cx="15" cy="10" r="0.9" fill="currentColor" stroke="none" />
    </svg>
  );
}

/** Effects tab glyph — lightning bolt. */
export function EffectIcon({ className = "size-5" }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="currentColor">
      <path d="M13 2L4 14h6l-1 8 9-12h-6z" />
    </svg>
  );
}

/** Coin/token bag — used for import/export and general value tiles. */
export function BagIcon({ className = "size-4" }: IconProps) {
  return (
    <svg {...base} className={className}>
      <path d="M9 8l-2.5 4.5A5 5 0 0 0 11 20h2a5 5 0 0 0 4.5-7.5L15 8" />
      <path d="M9 8a3 3 0 0 1 6 0" />
    </svg>
  );
}

/** Simple up/down arrows glyph for export/import actions. */
export function DownloadIcon({ className = "size-4" }: IconProps) {
  return (
    <svg {...base} className={className}>
      <path d="M12 4v11M7.5 11l4.5 4.5L16.5 11" />
      <path d="M4 19h16" />
    </svg>
  );
}

export function UploadIcon({ className = "size-4" }: IconProps) {
  return (
    <svg {...base} className={className}>
      <path d="M12 20V9M7.5 13.5L12 9l4.5 4.5" />
      <path d="M4 19h16" />
    </svg>
  );
}

/** Edit-account action glyph — pencil. */
export function PencilIcon({ className = "size-4" }: IconProps) {
  return (
    <svg {...base} className={className}>
      <path d="M4 20l1-4.2L15.5 5.3a1.5 1.5 0 0 1 2.1 0l1.1 1.1a1.5 1.5 0 0 1 0 2.1L8.2 19 4 20z" />
      <path d="M14 6.8l3.2 3.2" />
    </svg>
  );
}
