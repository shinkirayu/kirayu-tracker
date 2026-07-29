import { memo } from "react";
import { Link } from "react-router-dom";
import type { AccountListRow } from "../lib/types";
import { isOnline } from "../lib/types";
import type { ColumnPrefs } from "../lib/columnPrefs";
import { fmtFullNum, fmtNum, getPresenceLabel, onlineStatusTitle, prestigeRoman, timeAgo } from "../lib/format";
import { BagIcon, CoinIcon, EmoteIcon, GunIcon, KnifeIcon, MaskIcon, PawIcon, RadioIcon } from "./icons";
import { AssetImage } from "./AssetImage";

/** Real in-game asset id for the current event's Seashells icon (catalog key SummerKey2026). */
const SHELLS_ASSET_ID = "rbxassetid://126508703036392";

/** Stacked card view of AccountRow for narrow screens, where a wide table has to scroll sideways. */
export const AccountCard = memo(function AccountCard({
  account,
  columns,
  selected,
  onToggleSelect,
}: {
  account: AccountListRow;
  columns: ColumnPrefs;
  selected: boolean;
  onToggleSelect: (userId: number) => void;
}) {
  const online = isOnline(account.last_seen);
  const presence = getPresenceLabel(account, online);

  return (
    <div
      className={`cv-auto rounded-2xl border p-4 shadow-sm dark:bg-white/[0.03] ${
        selected
          ? "border-red-400 bg-red-50 dark:border-red-500/60 dark:bg-red-500/10"
          : "border-zinc-200/80 bg-white dark:border-red-500/10"
      }`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 items-center gap-2.5">
          <input
            type="checkbox"
            checked={selected}
            onChange={() => onToggleSelect(account.user_id)}
            className="size-3.5 shrink-0 accent-red-600"
            aria-label={`Select ${account.username}`}
          />
          <Link to={`/mm2/account/${account.user_id}`} className="group flex min-w-0 items-center gap-2.5">
            <span
              className={`size-2 shrink-0 rounded-full ${online ? "bg-emerald-500" : "bg-zinc-400 dark:bg-zinc-600"}`}
              title={onlineStatusTitle(account.last_seen, online)}
            />
            <div className="min-w-0">
              <div className="truncate text-sm font-semibold group-hover:text-red-600 dark:group-hover:text-red-400">
                {account.display_name || account.username}
              </div>
              <div className="truncate text-xs text-zinc-500 dark:text-zinc-400">@{account.username}</div>
            </div>
          </Link>
        </div>
        <div className="shrink-0 text-right text-xs whitespace-nowrap text-zinc-500 dark:text-zinc-400">
          <div className="font-display font-semibold text-zinc-700 dark:text-zinc-200">
            Lv {account.level ?? "—"}
            {account.prestige > 0 && <span className="ml-1 text-amber-500">{prestigeRoman(account.prestige)}</span>}
          </div>
          {timeAgo(account.last_seen)}
        </div>
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1.5 text-xs tabular-nums">
        {columns.coins && (
          <span className="inline-flex items-center gap-1 text-amber-600 dark:text-amber-400">
            <CoinIcon className="size-4" />
            {fmtNum(account.coins)}
          </span>
        )}
        {columns.shells && (
          <span className="inline-flex items-center gap-1 text-cyan-600 dark:text-cyan-400">
            <AssetImage rbxAssetId={SHELLS_ASSET_ID} alt="Seashells" className="size-4" fallback="🐚" />
            {fmtNum(account.shells)}
          </span>
        )}
        {columns.xp && <span className="text-zinc-500 dark:text-zinc-400">{fmtFullNum(account.xp)} XP</span>}
        {columns.presence && (
          <span
            title={presence}
            className={`font-semibold ${
              account.in_round && online ? "text-red-600 dark:text-red-400" : "text-zinc-500 dark:text-zinc-400"
            }`}
          >
            {presence}
          </span>
        )}
      </div>

      <div className="mt-3 grid grid-cols-7 gap-1.5 border-t border-zinc-100 pt-3 dark:border-white/[0.06]">
        {columns.weapons && <CountPill icon={KnifeIcon} value={account.weapon_count} label="Weapons" />}
        {columns.pets && <CountPill icon={PawIcon} value={account.pet_count} label="Pets" />}
        {columns.effects && <CountPill icon={GunIcon} value={account.effect_count} label="Effects" />}
        {columns.toys && <CountPill icon={MaskIcon} value={account.toy_count} label="Toys" />}
        {columns.emotes && <CountPill icon={EmoteIcon} value={account.emote_count} label="Emotes" />}
        {columns.radios && <CountPill icon={RadioIcon} value={account.radio_count} label="Radios" />}
        {columns.materials && <CountPill icon={BagIcon} value={account.material_count} label="Materials" />}
      </div>
    </div>
  );
});

function CountPill({
  icon: Icon,
  value,
  label,
}: {
  icon: (props: { className?: string }) => React.ReactElement;
  value: number;
  label: string;
}) {
  return (
    <div title={label} className="flex flex-col items-center gap-0.5 text-zinc-500 dark:text-zinc-400">
      <Icon className="size-3.5" />
      <span className="text-[11px] font-semibold tabular-nums text-zinc-700 dark:text-zinc-200">{value}</span>
    </div>
  );
}
