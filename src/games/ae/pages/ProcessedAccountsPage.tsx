import { useState } from "react";
import { Link } from "react-router-dom";
import { useProcessedAccounts } from "../hooks/useProcessedAccounts";
import { clearAutoswapRecord } from "../lib/autoswapHistory";
import { unmarkAccountListed } from "../lib/listedAccounts";
import { MarketplaceListingBar } from "../components/MarketplaceListingBar";

const hintCls = "text-[11px] text-zinc-500 dark:text-zinc-400";

function timeAgo(iso: string): string {
  const ms = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(ms / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

export default function ProcessedAccountsPage() {
  const [version, setVersion] = useState(0);
  const { accounts, isLoading } = useProcessedAccounts(version);
  const bump = () => setVersion((v) => v + 1);

  const [swapFilter, setSwapFilter] = useState<string>("all");
  const swapFilterOptions = Array.from(
    new Set(accounts.filter((a) => a.swapped).map((a) => `${a.swapped!.trait} ${a.swapped!.secret}`)),
  ).sort();
  const filtered =
    swapFilter === "all" ? accounts : accounts.filter((a) => a.swapped && `${a.swapped.trait} ${a.swapped.secret}` === swapFilter);

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
    setSelected((prev) => (prev.size === filtered.length ? new Set() : new Set(filtered.map((a) => a.user_id))));
  }
  function afterListingClosed(): void {
    setSelected(new Set());
    bump();
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-lg font-semibold tracking-tight">Processed Accounts</h1>
        <p className="text-sm text-zinc-500 dark:text-zinc-400">
          Everything pulled out of farming via Autoswap, and everything already listed on
          Eldorado/ZeusX — select any of them below to list on Eldorado/ZeusX without leaving this page.
        </p>
      </div>

      <div className="max-w-3xl rounded-xl border border-zinc-200 p-4 dark:border-white/10">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
          <h3 className="font-display text-sm font-semibold">
            Accounts ({filtered.length}){isLoading && " — loading…"}
          </h3>
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
                usernames={filtered.filter((a) => selected.has(a.user_id)).map((a) => a.username)}
                userIds={[...selected]}
                onDone={afterListingClosed}
              />
            )}
          </div>
        </div>

        {filtered.length === 0 ? (
          <p className={hintCls}>
            Nothing here yet — accounts show up once you autoswap one on the Autoswap tab, or list one
            on Eldorado/ZeusX from the Units tab.
          </p>
        ) : (
          <div className="space-y-2">
            <label className="flex items-center gap-2 text-xs font-semibold text-zinc-500 dark:text-zinc-400">
              <input
                type="checkbox"
                checked={selected.size === filtered.length}
                onChange={toggleSelectAll}
                className="size-3.5 accent-fuchsia-500"
              />
              Select all
            </label>
            {filtered.map((acc) => (
              <div
                key={acc.user_id}
                className="flex flex-wrap items-center gap-2.5 rounded-lg border border-zinc-200 bg-zinc-50 px-3 py-2 text-sm dark:border-white/5 dark:bg-white/[0.04]"
              >
                <input
                  type="checkbox"
                  checked={selected.has(acc.user_id)}
                  onChange={() => toggleSelect(acc.user_id)}
                  className="size-3.5 shrink-0 accent-fuchsia-500"
                />
                <Link
                  to={`/ae/account/${acc.user_id}`}
                  className="min-w-0 flex-1 font-medium hover:text-fuchsia-600 dark:hover:text-fuchsia-400"
                >
                  {acc.display_name || acc.username}{" "}
                  <span className="text-xs font-normal text-zinc-500 dark:text-zinc-400">@{acc.username}</span>
                </Link>

                <div className="flex flex-wrap items-center gap-1.5">
                  {acc.swapped && (
                    <span
                      title={`Autoswapped ${timeAgo(acc.swapped.at)} — outcome: ${acc.swapped.outcome}`}
                      className="inline-flex items-center gap-1 rounded-full bg-fuchsia-100 px-2 py-0.5 text-[11px] font-semibold text-fuchsia-700 dark:bg-fuchsia-500/15 dark:text-fuchsia-400"
                    >
                      {acc.swapped.trait} {acc.swapped.secret}
                      <button
                        onClick={() => {
                          clearAutoswapRecord(acc.user_id);
                          bump();
                        }}
                        title="Clear swap record"
                        className="ml-0.5 text-fuchsia-400 hover:text-fuchsia-700 dark:hover:text-fuchsia-200"
                      >
                        ×
                      </button>
                    </span>
                  )}
                  {acc.listed?.eldorado && (
                    <span
                      title={`Listed on Eldorado ${timeAgo(acc.listed.eldorado)}`}
                      className="inline-flex items-center gap-1 rounded-full bg-purple-100 px-2 py-0.5 text-[11px] font-semibold text-purple-700 dark:bg-purple-500/15 dark:text-purple-400"
                    >
                      Eldorado
                      <button
                        onClick={() => {
                          unmarkAccountListed(acc.user_id, "eldorado");
                          bump();
                        }}
                        title="Clear Eldorado listed status"
                        className="ml-0.5 text-purple-400 hover:text-purple-700 dark:hover:text-purple-200"
                      >
                        ×
                      </button>
                    </span>
                  )}
                  {acc.listed?.zeusx && (
                    <span
                      title={`Listed on ZeusX ${timeAgo(acc.listed.zeusx)}`}
                      className="inline-flex items-center gap-1 rounded-full bg-cyan-100 px-2 py-0.5 text-[11px] font-semibold text-cyan-700 dark:bg-cyan-500/15 dark:text-cyan-400"
                    >
                      ZeusX
                      <button
                        onClick={() => {
                          unmarkAccountListed(acc.user_id, "zeusx");
                          bump();
                        }}
                        title="Clear ZeusX listed status"
                        className="ml-0.5 text-cyan-400 hover:text-cyan-700 dark:hover:text-cyan-200"
                      >
                        ×
                      </button>
                    </span>
                  )}
                  {acc.lastActivity && <span className={hintCls}>{timeAgo(acc.lastActivity)}</span>}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
