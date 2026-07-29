import { useState } from "react";
import { Link } from "react-router-dom";
import { useProcessedAccounts } from "../hooks/useProcessedAccounts";
import { clearAutoswapRecord } from "../lib/autoswapHistory";
import { unmarkAccountListed } from "../lib/listedAccounts";

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

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-lg font-semibold tracking-tight">Processed Accounts</h1>
        <p className="text-sm text-zinc-500 dark:text-zinc-400">
          Everything pulled out of farming via Autoswap, and everything already listed on
          Eldorado/ZeusX — one place to track an account from "swapped out" to "sold."
        </p>
      </div>

      <div className="max-w-3xl rounded-xl border border-zinc-200 p-4 dark:border-white/10">
        <h3 className="font-display mb-3 text-sm font-semibold">
          Accounts ({accounts.length}){isLoading && " — loading…"}
        </h3>

        {accounts.length === 0 ? (
          <p className={hintCls}>
            Nothing here yet — accounts show up once you autoswap one on the Autoswap tab, or list one
            on Eldorado/ZeusX from the Units tab.
          </p>
        ) : (
          <div className="space-y-2">
            {accounts.map((acc) => (
              <div
                key={acc.user_id}
                className="rounded-lg border border-zinc-200 bg-zinc-50 px-3 py-2 text-sm dark:border-white/5 dark:bg-white/[0.04]"
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <Link
                    to={`/ae/account/${acc.user_id}`}
                    className="min-w-0 font-medium hover:text-fuchsia-600 dark:hover:text-fuchsia-400"
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
                        Swapped ({acc.swapped.secret})
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
                    {acc.lastActivity && (
                      <span className={hintCls}>{timeAgo(acc.lastActivity)}</span>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
