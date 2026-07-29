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

/** Memoized so a realtime patch to one row never re-renders the whole table. */
export const AccountRow = memo(function AccountRow({
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
    <tr
      className={`cv-auto border-b align-middle last:border-0 hover:bg-zinc-50 dark:border-white/[0.04] dark:hover:bg-white/[0.03] ${
        selected ? "bg-red-50 dark:bg-red-500/10" : "border-zinc-100"
      }`}
    >
      <td className="py-2.5 pr-0 pl-4 align-middle">
        <input
          type="checkbox"
          checked={selected}
          onChange={() => onToggleSelect(account.user_id)}
          className="size-3.5 accent-red-600"
          aria-label={`Select ${account.username}`}
        />
      </td>
      <td className="py-2.5 pr-3 pl-3 align-middle">
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
      </td>
      <td className="px-3 py-2.5 text-center align-middle tabular-nums">
        {account.level ?? "—"}
        {account.prestige > 0 && <span className="ml-1 text-xs text-amber-500">{prestigeRoman(account.prestige)}</span>}
      </td>
      {columns.coins && (
        <td className="px-3 py-2.5 text-center align-middle tabular-nums text-amber-600 dark:text-amber-400">
          <span className="inline-flex items-center gap-1">
            <CoinIcon className="size-4" />
            {fmtNum(account.coins)}
          </span>
        </td>
      )}
      {columns.shells && (
        <td className="px-3 py-2.5 text-center align-middle tabular-nums text-cyan-600 dark:text-cyan-400">
          <span className="inline-flex items-center gap-1">
            <AssetImage rbxAssetId={SHELLS_ASSET_ID} alt="Seashells" className="size-4" fallback="🐚" />
            {fmtNum(account.shells)}
          </span>
        </td>
      )}
      {columns.xp && <td className="px-3 py-2.5 text-center align-middle tabular-nums">{fmtFullNum(account.xp)}</td>}
      {columns.weapons && <td className="px-3 py-2.5 text-center align-middle tabular-nums">{account.weapon_count}</td>}
      {columns.pets && <td className="px-3 py-2.5 text-center align-middle tabular-nums">{account.pet_count}</td>}
      {columns.effects && <td className="px-3 py-2.5 text-center align-middle tabular-nums">{account.effect_count}</td>}
      {columns.toys && <td className="px-3 py-2.5 text-center align-middle tabular-nums">{account.toy_count}</td>}
      {columns.emotes && <td className="px-3 py-2.5 text-center align-middle tabular-nums">{account.emote_count}</td>}
      {columns.radios && <td className="px-3 py-2.5 text-center align-middle tabular-nums">{account.radio_count}</td>}
      {columns.materials && (
        <td className="px-3 py-2.5 text-center align-middle tabular-nums">{account.material_count}</td>
      )}
      {columns.presence && (
        <td
          title={presence}
          className={`truncate px-3 py-2.5 text-center align-middle text-xs font-semibold whitespace-nowrap ${
            account.in_round && online ? "text-red-600 dark:text-red-400" : "text-zinc-500 dark:text-zinc-400"
          }`}
        >
          {presence}
        </td>
      )}
      <td className="py-2.5 pr-4 pl-3 text-right align-middle text-xs whitespace-nowrap text-zinc-500 dark:text-zinc-400">
        {timeAgo(account.last_seen)}
      </td>
    </tr>
  );
});

/** Re-exported so DashboardPage's <colgroup>/<thead> can share the same category icon set. */
export const CATEGORY_ICONS = { KnifeIcon, PawIcon, GunIcon, MaskIcon, EmoteIcon, RadioIcon, BagIcon };
