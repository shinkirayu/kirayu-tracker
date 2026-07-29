import { useState } from "react";
import { useToast } from "../../../components/Toast";
import {
  ALL_TRAITS,
  useUnboundSecrets,
  type UnboundAccountMatch,
  type UnboundSecretsFilters,
} from "../hooks/useUnboundSecrets";
import {
  autoswapComplete,
  getAccountOpsApiKey,
  getAutoswapOptions,
  saveAccountOpsApiKey,
  saveAutoswapOptions,
  type AutoswapOptions,
} from "../lib/accountops";
import { clearAllAutoswapHistory, markAutoswapped, type UnboundSecret } from "../lib/autoswapHistory";
import { useProcessedAccounts } from "../hooks/useProcessedAccounts";
import { MarketplaceListingBar } from "../components/MarketplaceListingBar";

const inputCls =
  "w-full rounded-lg border border-zinc-200 bg-transparent p-2 text-sm outline-none focus:border-fuchsia-400 dark:border-zinc-700";
const labelCls = "text-xs font-semibold text-zinc-600 dark:text-zinc-300";
const hintCls = "text-[11px] text-zinc-500 dark:text-zinc-400";

type RowStatus = "idle" | "swapping" | "done" | "not_fired" | "error";

/** Crow/Shadow entries are the only ones with a configured AccountOps rule — everything else (shown only when "all secrets" is on) is informational. */
function swappableSecrets(match: UnboundAccountMatch): UnboundSecret[] {
  const set = new Set<UnboundSecret>();
  for (const e of match.entries) if (e.secret) set.add(e.secret);
  return [...set];
}

/** Which trait(s) actually triggered the swap, read off the matching entries themselves (not the page's filter) so it's accurate even in "all traits" mode. */
function traitLabelFor(match: UnboundAccountMatch): string {
  const traits = new Set(match.entries.filter((e) => e.secret).map((e) => e.trait).filter((t): t is string => !!t));
  return traits.size > 0 ? [...traits].join(" + ") : "—";
}

export default function AutoswapPage() {
  const toast = useToast();
  const [historyVersion, setHistoryVersion] = useState(0);
  const [filters, setFilters] = useState<UnboundSecretsFilters>({ trait: "Unbound", allSecrets: false });
  const { matches, availableTraits, isLoading } = useUnboundSecrets(filters, historyVersion);

  const [apiKeyInput, setApiKeyInput] = useState(() => getAccountOpsApiKey());
  const [options, setOptions] = useState<AutoswapOptions>(() => getAutoswapOptions());
  const [rowStatus, setRowStatus] = useState<Record<number, RowStatus>>({});
  const [runningAll, setRunningAll] = useState(false);

  const { accounts: processed } = useProcessedAccounts(historyVersion);
  const readyToListAll = processed.filter((a) => a.swapped && !a.listed?.eldorado && !a.listed?.zeusx);
  const [swapFilter, setSwapFilter] = useState<string>("all");
  const swapFilterOptions = Array.from(
    new Set(readyToListAll.map((a) => `${a.swapped!.trait} ${a.swapped!.secret}`)),
  ).sort();
  const readyToList =
    swapFilter === "all" ? readyToListAll : readyToListAll.filter((a) => `${a.swapped!.trait} ${a.swapped!.secret}` === swapFilter);
  const [selected, setSelected] = useState<Set<number>>(new Set());
  function toggleSelect(userId: number): void {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(userId)) next.delete(userId);
      else next.add(userId);
      return next;
    });
  }
  function toggleSelectAll(): void {
    setSelected((prev) => (prev.size === readyToList.length ? new Set() : new Set(readyToList.map((a) => a.user_id))));
  }
  function afterListingClosed(): void {
    setSelected(new Set());
    setHistoryVersion((v) => v + 1);
  }

  function resetPending(): void {
    clearAllAutoswapHistory();
    setRowStatus({});
    setHistoryVersion((v) => v + 1);
    toast.info("Pending list reset", "Every account currently matching the filters below will show up again.");
  }

  function saveSettings(): void {
    try {
      saveAccountOpsApiKey(apiKeyInput);
      saveAutoswapOptions(options);
      toast.success("Autoswap settings saved");
    } catch (err) {
      toast.error("Couldn't save", err instanceof Error ? err.message : String(err));
    }
  }

  /** Both secrets fire the dedicated "Both" rule (falling back to the Crow rule if that's not set up yet). */
  function optionFor(secrets: UnboundSecret[]): number | null {
    if (secrets.length > 1) return options.both ?? options.crow;
    return secrets[0] === "Crow" ? options.crow : options.shadow;
  }

  function labelFor(secrets: UnboundSecret[]): "Crow" | "Shadow" | "Both" {
    return secrets.length > 1 ? "Both" : secrets[0];
  }

  async function swapOne(match: UnboundAccountMatch): Promise<boolean> {
    const secrets = swappableSecrets(match);
    if (secrets.length === 0) return false; // view-only row, no button to trigger this anyway
    const label = labelFor(secrets);
    const option = optionFor(secrets);
    if (!option) {
      toast.error("No rule number set", `Set the AccountOps rule number for Unbound ${label} in Settings first.`);
      return false;
    }

    setRowStatus((prev) => ({ ...prev, [match.user_id]: "swapping" }));
    try {
      const res = await autoswapComplete(match.username, option);
      // Only "swapped"/"moved" are real progress — mark done and drop off the
      // pending list. "not_fired" means AccountOps did nothing at all (wrong
      // rule, rule paused, or — most commonly — this account isn't assigned
      // to the Config that rule number lives on yet), so it must stay
      // pending and NOT be recorded as handled, or a real swap would never
      // get another chance to run.
      if (res.outcome === "swapped" || res.outcome === "moved") {
        markAutoswapped(match.user_id, label, traitLabelFor(match), res.outcome);
        setRowStatus((prev) => ({ ...prev, [match.user_id]: "done" }));
        if (res.outcome === "swapped") {
          toast.success(`${match.username} swapped`, res.replacement ? `Replacement: ${res.replacement}` : undefined);
        } else {
          toast.success(`${match.username} moved out`, "No replacement was free to take its slot.");
        }
        return true;
      }
      setRowStatus((prev) => ({ ...prev, [match.user_id]: "not_fired" }));
      toast.info(
        `${match.username}: not fired`,
        "Nothing changed — check that this account is assigned to the right Autoswap Config in AccountOps, and that the rule number matches its position there (1 = first rule, 2 = second). Safe to retry.",
      );
      return false;
    } catch (err) {
      setRowStatus((prev) => ({ ...prev, [match.user_id]: "error" }));
      toast.error(`Couldn't swap ${match.username}`, err instanceof Error ? err.message : String(err));
      return false;
    }
  }

  async function swapAll(): Promise<void> {
    setRunningAll(true);
    try {
      for (const match of matches) {
        if (rowStatus[match.user_id] === "done") continue;
        if (swappableSecrets(match).length === 0) continue;
        await swapOne(match);
      }
    } finally {
      setRunningAll(false);
    }
  }

  const pending = matches
    .filter((m) => rowStatus[m.user_id] !== "done")
    // Accounts with both secrets pending float to the top — they're the highest-value ones to act on first.
    .sort((a, b) => swappableSecrets(b).length - swappableSecrets(a).length);
  const bothCount = pending.filter((m) => swappableSecrets(m).length > 1).length;
  const swappableCount = pending.filter((m) => swappableSecrets(m).length > 0).length;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-lg font-semibold tracking-tight">Autoswap</h1>
        <p className="text-sm text-zinc-500 dark:text-zinc-400">
          Pull a farming account out of rotation the moment it rolls an Unbound Crow or Unbound Shadow,
          via AccountOps.
        </p>
      </div>

      <div className="max-w-2xl rounded-xl border border-zinc-200 p-4 dark:border-white/10">
        <h3 className="font-display mb-1 text-sm font-semibold">Settings</h3>
        <p className={`mb-3 ${hintCls}`}>
          Stored in this browser's localStorage only, sent to AccountOps through the site's own
          proxy — never stored on the server.
        </p>

        <div className="space-y-3">
          <div className="space-y-1.5">
            <label className={labelCls}>AccountOps API key</label>
            <input
              type="password"
              value={apiKeyInput}
              onChange={(e) => setApiKeyInput(e.target.value)}
              placeholder="ak_your_api_key"
              autoComplete="off"
              className={inputCls}
            />
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div className="space-y-1.5">
              <label className={labelCls}>Unbound Crow rule #</label>
              <input
                type="number"
                min={1}
                value={options.crow ?? ""}
                onChange={(e) =>
                  setOptions((prev) => ({ ...prev, crow: e.target.value ? Number(e.target.value) : null }))
                }
                placeholder="e.g. 1"
                className={inputCls}
              />
            </div>
            <div className="space-y-1.5">
              <label className={labelCls}>Unbound Shadow rule #</label>
              <input
                type="number"
                min={1}
                value={options.shadow ?? ""}
                onChange={(e) =>
                  setOptions((prev) => ({ ...prev, shadow: e.target.value ? Number(e.target.value) : null }))
                }
                placeholder="e.g. 2"
                className={inputCls}
              />
            </div>
            <div className="space-y-1.5">
              <label className={labelCls}>Both (Crow + Shadow) rule #</label>
              <input
                type="number"
                min={1}
                value={options.both ?? ""}
                onChange={(e) =>
                  setOptions((prev) => ({ ...prev, both: e.target.value ? Number(e.target.value) : null }))
                }
                placeholder="e.g. 3"
                className={inputCls}
              />
            </div>
          </div>
          <p className={hintCls}>
            These match the rule numbers on AccountOps' own Autoswap page (1 = first rule, 2 = second,
            ...). Create a third rule there for accounts that roll both at once — its own output folder,
            separate from the Crow-only/Shadow-only ones. If you leave "Both" blank, those accounts fire
            the Crow rule instead.
          </p>

          <button
            onClick={saveSettings}
            className="gradient-purple rounded-lg px-3 py-1.5 text-xs font-semibold text-white"
          >
            Save settings
          </button>
        </div>
      </div>

      <div className="max-w-2xl rounded-xl border border-zinc-200 p-4 dark:border-white/10">
        <h3 className="font-display mb-3 text-sm font-semibold">Filters</h3>
        <div className="flex flex-wrap items-end gap-3">
          <div className="space-y-1.5">
            <label className={labelCls}>Trait</label>
            <select
              value={filters.trait}
              onChange={(e) => setFilters((prev) => ({ ...prev, trait: e.target.value }))}
              className={inputCls}
            >
              {availableTraits.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
              <option value={ALL_TRAITS}>All traits</option>
            </select>
          </div>
          <label className="flex items-center gap-2 pb-2 text-xs font-semibold text-zinc-600 dark:text-zinc-300">
            <input
              type="checkbox"
              checked={filters.allSecrets}
              onChange={(e) => setFilters((prev) => ({ ...prev, allSecrets: e.target.checked }))}
              className="size-4 accent-fuchsia-500"
            />
            Show all Secret-rarity units
          </label>
        </div>
        <p className={`mt-2 ${hintCls}`}>
          "Show all Secret-rarity units" broadens the list beyond Crow/Shadow to every Secret-rarity
          unit — useful for browsing, but only Crow/Shadow (highlighted) have a Swap button, since
          those are the only ones with a configured AccountOps rule.
        </p>
      </div>

      <div className="max-w-2xl rounded-xl border border-zinc-200 p-4 dark:border-white/10">
        <div className="mb-3 flex items-center justify-between gap-3">
          <h3 className="font-display text-sm font-semibold">
            Pending ({pending.length}){isLoading && " — loading…"}
          </h3>
          <div className="flex items-center gap-2">
            <button
              onClick={resetPending}
              title="Clear local swap history so every account currently matching the filters reappears"
              className="rounded-lg border border-zinc-200 px-3 py-1.5 text-xs font-medium text-zinc-600 transition-colors hover:border-fuchsia-400 dark:border-zinc-700 dark:text-zinc-300"
            >
              Reset pending
            </button>
            {swappableCount > 0 && (
              <button
                onClick={swapAll}
                disabled={runningAll}
                className="gradient-purple rounded-lg px-3 py-1.5 text-xs font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50"
              >
                {runningAll ? "Swapping…" : `Swap all (${swappableCount})`}
              </button>
            )}
          </div>
        </div>

        {bothCount > 0 && (
          <p className="mb-3 rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-xs font-semibold text-amber-800 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-300">
            ⭐ {bothCount} account{bothCount === 1 ? "" : "s"} {bothCount === 1 ? "has" : "have"} both an Unbound
            Crow and an Unbound Shadow right now — listed first below, firing the "Both" rule.
          </p>
        )}

        {pending.length === 0 ? (
          <p className={hintCls}>No tracked accounts currently match these filters.</p>
        ) : (
          <div className="space-y-2">
            {pending.map((match) => {
              const status = rowStatus[match.user_id] ?? "idle";
              const secrets = swappableSecrets(match);
              const isBoth = secrets.length > 1;
              const isSwappable = secrets.length > 0;
              return (
                <div
                  key={match.user_id}
                  className={`rounded-lg border px-3 py-2 text-sm ${
                    isBoth
                      ? "border-amber-300 bg-amber-50 dark:border-amber-500/40 dark:bg-amber-500/10"
                      : "border-zinc-200 bg-zinc-50 dark:border-white/5 dark:bg-white/[0.04]"
                  }`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <div className="min-w-0">
                      <span className="font-medium">{match.display_name || match.username}</span>{" "}
                      <span className="text-xs text-zinc-500 dark:text-zinc-400">@{match.username}</span>
                      {isBoth && (
                        <span className="ml-2 rounded-full bg-amber-200 px-2 py-0.5 text-[11px] font-semibold text-amber-800 dark:bg-amber-500/25 dark:text-amber-300">
                          ⭐ Both
                        </span>
                      )}
                      {match.entries.map((entry) => (
                        <span
                          key={`${entry.unitName}|${entry.trait ?? ""}`}
                          className={`ml-2 rounded-full px-2 py-0.5 text-[11px] font-semibold ${
                            entry.secret
                              ? "bg-fuchsia-100 text-fuchsia-700 dark:bg-fuchsia-500/15 dark:text-fuchsia-400"
                              : "bg-zinc-200 text-zinc-600 dark:bg-white/10 dark:text-zinc-300"
                          }`}
                        >
                          {entry.trait ? `${entry.trait} ` : ""}
                          {entry.unitName}
                        </span>
                      ))}
                      {status === "not_fired" && (
                        <span className="ml-2 rounded-full bg-amber-100 px-2 py-0.5 text-[11px] font-semibold text-amber-700 dark:bg-amber-500/15 dark:text-amber-400">
                          Not fired
                        </span>
                      )}
                      {status === "error" && (
                        <span className="ml-2 rounded-full bg-red-100 px-2 py-0.5 text-[11px] font-semibold text-red-700 dark:bg-red-500/15 dark:text-red-400">
                          Failed
                        </span>
                      )}
                    </div>
                    {isSwappable ? (
                      <button
                        onClick={() => swapOne(match)}
                        disabled={status === "swapping" || runningAll}
                        className="shrink-0 rounded-md border border-fuchsia-300 bg-white px-2.5 py-1 text-xs font-semibold text-fuchsia-600 transition-colors hover:border-fuchsia-400 disabled:cursor-not-allowed disabled:opacity-50 dark:border-fuchsia-500/40 dark:bg-white/5 dark:text-fuchsia-400"
                      >
                        {status === "swapping"
                          ? "Swapping…"
                          : status === "error" || status === "not_fired"
                            ? "Retry"
                            : isBoth
                              ? "Swap now (Both)"
                              : "Swap now"}
                      </button>
                    ) : (
                      <span className="shrink-0 text-[11px] text-zinc-400 dark:text-zinc-500">View only</span>
                    )}
                  </div>
                  {status === "not_fired" && (
                    <p className={`mt-1.5 ${hintCls}`}>
                      Nothing changed in AccountOps. Most likely this account isn't assigned to the
                      Autoswap Config that rule number lives on yet — check the Accounts/Devices page
                      in AccountOps.
                    </p>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      <div className="max-w-2xl rounded-xl border border-zinc-200 p-4 dark:border-white/10">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
          <h3 className="font-display text-sm font-semibold">Swapped — ready to list ({readyToList.length})</h3>
          <div className="flex items-center gap-2">
            {swapFilterOptions.length > 0 && (
              <select
                value={swapFilter}
                onChange={(e) => setSwapFilter(e.target.value)}
                className="rounded-lg border border-zinc-200 bg-transparent px-2 py-1.5 text-xs outline-none focus:border-fuchsia-400 dark:border-zinc-700"
              >
                <option value="all">All swapped</option>
                {swapFilterOptions.map((o) => (
                  <option key={o} value={o}>
                    {o} only
                  </option>
                ))}
              </select>
            )}
            {selected.size > 0 && (
              <MarketplaceListingBar
                usernames={readyToList.filter((a) => selected.has(a.user_id)).map((a) => a.username)}
                userIds={[...selected]}
                onDone={afterListingClosed}
              />
            )}
          </div>
        </div>

        {readyToList.length === 0 ? (
          <p className={hintCls}>
            Accounts land here right after a successful swap above. Select one or more, then list them
            on Eldorado/ZeusX without leaving this page.
          </p>
        ) : (
          <div className="space-y-2">
            <label className="flex items-center gap-2 text-xs font-semibold text-zinc-500 dark:text-zinc-400">
              <input
                type="checkbox"
                checked={selected.size === readyToList.length}
                onChange={toggleSelectAll}
                className="size-3.5 accent-fuchsia-500"
              />
              Select all
            </label>
            {readyToList.map((acc) => (
              <label
                key={acc.user_id}
                className="flex cursor-pointer items-center gap-2.5 rounded-lg border border-zinc-200 bg-zinc-50 px-3 py-2 text-sm dark:border-white/5 dark:bg-white/[0.04]"
              >
                <input
                  type="checkbox"
                  checked={selected.has(acc.user_id)}
                  onChange={() => toggleSelect(acc.user_id)}
                  className="size-3.5 shrink-0 accent-fuchsia-500"
                />
                <span className="min-w-0 flex-1">
                  <span className="font-medium">{acc.display_name || acc.username}</span>{" "}
                  <span className="text-xs text-zinc-500 dark:text-zinc-400">@{acc.username}</span>
                </span>
                {acc.swapped && (
                  <span className="shrink-0 rounded-full bg-fuchsia-100 px-2 py-0.5 text-[11px] font-semibold text-fuchsia-700 dark:bg-fuchsia-500/15 dark:text-fuchsia-400">
                    {acc.swapped.trait} {acc.swapped.secret}
                  </span>
                )}
              </label>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
