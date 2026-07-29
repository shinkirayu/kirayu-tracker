import { useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { useAccount, useAccountDetails } from "../hooks/useAccountDetail";
import { useAccountRealtime } from "../hooks/useAccountsRealtime";
import { useItemValueOverrides, useSetItemValue } from "../hooks/useItemValueOverrides";
import { isOnline } from "../lib/types";
import { fmtFullNum, getPresenceLabel, onlineStatusTitle, prestigeRoman, timeAgo } from "../lib/format";
import { BagIcon, CoinIcon, EffectIcon, EmoteIcon, KnifeIcon, MaskIcon, PawIcon, PencilIcon, RadioIcon } from "../components/icons";
import { InventoryPanel, estimateAccountValue } from "../components/InventoryPanel";
import { ImportExportPanel } from "../components/ImportExportPanel";
import { EditAccountModal } from "../components/EditAccountModal";
import { RoleBadge } from "../components/RoleBadge";
import { AssetImage } from "../components/AssetImage";

export default function AccountPage() {
  const params = useParams();
  const userId = params.userId ? Number(params.userId) : null;
  const { data: account, isLoading, isError } = useAccount(userId);
  const details = useAccountDetails(userId);
  useAccountRealtime(userId);

  const overrides = useItemValueOverrides();
  const setValue = useSetItemValue();
  const [editing, setEditing] = useState(false);

  const totalValue = useMemo(
    () => estimateAccountValue(details.data, overrides.data ?? {}),
    [details.data, overrides.data],
  );

  if (isLoading) {
    return <div className="animate-pulse rounded-xl bg-zinc-100 p-16 dark:bg-zinc-900" />;
  }
  if (isError || !account) {
    return (
      <div className="rounded-xl border border-red-300 bg-red-50 p-6 text-red-800 dark:border-red-800 dark:bg-red-950 dark:text-red-200">
        Account not found.{" "}
        <Link to="/mm2" className="underline">
          Back to dashboard
        </Link>
      </div>
    );
  }

  const online = isOnline(account.last_seen);
  const presence = getPresenceLabel(account, online);
  const progressPct = account.level_progress != null ? Math.round(account.level_progress * 100) : null;
  // Event currencies rotate (Materials entries flagged Currency=true, e.g.
  // Summer 2026's "Shells") — surfaced generically so a new event's
  // currency shows up here without another code change.
  const currencies = (details.data?.materials ?? []).filter((m) => m.Currency);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-3">
        <Link to="/mm2" className="text-sm font-medium text-red-600 hover:underline dark:text-red-400">
          ← All accounts
        </Link>
        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={() => setEditing(true)}
            className="flex items-center gap-1.5 rounded-lg border border-zinc-200 px-3 py-1.5 text-xs font-semibold text-zinc-600 transition-colors hover:border-red-400 dark:border-white/10 dark:text-zinc-300"
          >
            <PencilIcon /> Edit
          </button>
          <ImportExportPanel account={account} details={details.data ?? null} />
        </div>
      </div>

      {editing && <EditAccountModal account={account} onClose={() => setEditing(false)} />}

      {/* Header */}
      <div className="rounded-2xl border border-zinc-200/80 bg-white p-5 shadow-sm dark:border-red-500/10 dark:bg-white/[0.03]">
        <div className="flex flex-wrap items-center gap-4">
          <div className="gradient-blood flex size-14 items-center justify-center rounded-full text-lg font-bold text-white shadow-[0_0_14px_rgba(165,0,8,0.4)]">
            {account.username.slice(0, 2).toUpperCase()}
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="font-display text-xl font-semibold">{account.display_name || account.username}</h1>
              <span
                title={onlineStatusTitle(account.last_seen, online)}
                className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${
                  online
                    ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300"
                    : "bg-zinc-100 text-zinc-500 dark:bg-zinc-800 dark:text-zinc-400"
                }`}
              >
                {online ? (account.in_round ? "IN ROUND" : "ONLINE") : "OFFLINE"}
              </span>
              {account.in_round && <RoleBadge role={account.role} />}
            </div>
            <p className="text-sm text-zinc-500 dark:text-zinc-400">
              @{account.username} · ID {account.user_id} · updated {timeAgo(account.updated_at)}
              {account.in_round && account.map ? ` · ${presence}` : ""}
            </p>
          </div>
          <div className="text-right">
            <div className="font-display text-3xl font-semibold tabular-nums">
              Lv {account.level ?? "?"}
              {account.prestige > 0 && (
                <span className="ml-1.5 text-lg text-amber-500">{prestigeRoman(account.prestige)}</span>
              )}
            </div>
            <div className="text-xs text-zinc-500 dark:text-zinc-400">
              {fmtFullNum(account.xp)} XP{progressPct != null ? ` · ${progressPct}% to next` : ""}
            </div>
          </div>
        </div>

        {progressPct != null && (
          <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-zinc-100 dark:bg-white/[0.06]">
            <div className="gradient-blood h-full rounded-full" style={{ width: `${progressPct}%` }} />
          </div>
        )}

        <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-9">
          <Tile label="Coins" value={fmtFullNum(account.coins)} icon={<CoinIcon className="size-5 text-amber-500" />} />
          <Tile label="Est. value" value={fmtFullNum(totalValue)} />
          <Tile label="Weapons" value={fmtFullNum(account.weapon_count)} icon={<KnifeIcon className="size-5" />} />
          <Tile label="Pets" value={fmtFullNum(account.pet_count)} icon={<PawIcon className="size-5" />} />
          <Tile label="Effects" value={fmtFullNum(account.effect_count)} icon={<EffectIcon className="size-5" />} />
          <Tile label="Toys" value={fmtFullNum(account.toy_count)} icon={<MaskIcon className="size-5" />} />
          <Tile label="Emotes" value={fmtFullNum(account.emote_count)} icon={<EmoteIcon className="size-5" />} />
          <Tile label="Radios" value={fmtFullNum(account.radio_count)} icon={<RadioIcon className="size-5" />} />
          <Tile label="Materials" value={fmtFullNum(account.material_count)} icon={<BagIcon className="size-5" />} />
        </div>

        {currencies.length > 0 && (
          <div className="mt-3 flex flex-wrap gap-2 border-t border-zinc-100 pt-3 dark:border-white/[0.06]">
            {currencies.map((c) => (
              <div
                key={c.Key}
                title={c.Name}
                className="flex items-center gap-1.5 rounded-full bg-zinc-50 py-1 pr-3 pl-1.5 dark:bg-white/[0.04]"
              >
                <AssetImage
                  rbxAssetId={c.Image}
                  alt={c.Name}
                  className="size-5 rounded-full"
                  fallback={<BagIcon className="size-4 text-amber-500" />}
                />
                <span className="text-xs font-semibold text-zinc-600 dark:text-zinc-300">{c.Name}</span>
                <span className="font-display text-xs font-bold tabular-nums text-amber-600 dark:text-amber-400">
                  {fmtFullNum(c.Quantity)}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Inventory */}
      <div className="rounded-2xl border border-zinc-200/80 bg-white p-5 shadow-sm dark:border-red-500/10 dark:bg-white/[0.03]">
        <h2 className="font-display mb-3 text-sm font-semibold">Inventory</h2>
        <InventoryPanel
          details={details.data}
          isLoading={details.isLoading}
          valueOverrides={overrides.data ?? {}}
          onSetValue={(itemKey, value) => setValue.mutate({ itemKey, value })}
        />
      </div>
    </div>
  );
}

function Tile({ label, value, icon }: { label: string; value: string; icon?: React.ReactNode }) {
  return (
    <div className="rounded-lg bg-zinc-50 p-3 text-center dark:bg-white/[0.04]">
      <div className="text-[11px] font-semibold text-zinc-500 dark:text-zinc-400">{label}</div>
      <div className="font-display flex items-center justify-center gap-1.5 text-lg font-semibold tabular-nums">
        {icon}
        {value}
      </div>
    </div>
  );
}
