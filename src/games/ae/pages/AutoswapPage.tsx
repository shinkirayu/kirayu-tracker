import { useState } from "react";
import { useToast } from "../../../components/Toast";
import { useUnboundSecrets, type UnboundSecretMatch } from "../hooks/useUnboundSecrets";
import {
  autoswapComplete,
  getAccountOpsApiKey,
  getAutoswapOptions,
  saveAccountOpsApiKey,
  saveAutoswapOptions,
  type AutoswapOptions,
} from "../lib/accountops";
import { markAutoswapped } from "../lib/autoswapHistory";

const inputCls =
  "w-full rounded-lg border border-zinc-200 bg-transparent p-2 text-sm outline-none focus:border-fuchsia-400 dark:border-zinc-700";
const labelCls = "text-xs font-semibold text-zinc-600 dark:text-zinc-300";
const hintCls = "text-[11px] text-zinc-500 dark:text-zinc-400";

type RowStatus = "idle" | "swapping" | "done" | "not_fired" | "error";

export default function AutoswapPage() {
  const toast = useToast();
  const { matches, isLoading } = useUnboundSecrets();

  const [apiKeyInput, setApiKeyInput] = useState(() => getAccountOpsApiKey());
  const [options, setOptions] = useState<AutoswapOptions>(() => getAutoswapOptions());
  const [rowStatus, setRowStatus] = useState<Record<number, RowStatus>>({});
  const [runningAll, setRunningAll] = useState(false);

  function saveSettings(): void {
    try {
      saveAccountOpsApiKey(apiKeyInput);
      saveAutoswapOptions(options);
      toast.success("Autoswap settings saved");
    } catch (err) {
      toast.error("Couldn't save", err instanceof Error ? err.message : String(err));
    }
  }

  function optionFor(secret: UnboundSecretMatch["secret"]): number | null {
    return secret === "Crow" ? options.crow : options.shadow;
  }

  async function swapOne(match: UnboundSecretMatch): Promise<boolean> {
    const option = optionFor(match.secret);
    if (!option) {
      toast.error(
        "No rule number set",
        `Set the AccountOps rule number for Unbound ${match.secret} in Settings first.`,
      );
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
        markAutoswapped(match.user_id, match.secret, res.outcome);
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
        await swapOne(match);
      }
    } finally {
      setRunningAll(false);
    }
  }

  const pending = matches.filter((m) => rowStatus[m.user_id] !== "done");

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

          <div className="grid grid-cols-2 gap-3">
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
          </div>
          <p className={hintCls}>
            These match the rule numbers on AccountOps' own Settings → Autoswap page (1 = first rule,
            2 = second, ...) — the output folders for Unbound Crow/Shadow need to exist there first.
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
        <div className="mb-3 flex items-center justify-between gap-3">
          <h3 className="font-display text-sm font-semibold">
            Pending ({pending.length}){isLoading && " — loading…"}
          </h3>
          {pending.length > 0 && (
            <button
              onClick={swapAll}
              disabled={runningAll}
              className="gradient-purple rounded-lg px-3 py-1.5 text-xs font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50"
            >
              {runningAll ? "Swapping…" : `Swap all (${pending.length})`}
            </button>
          )}
        </div>

        {pending.length === 0 ? (
          <p className={hintCls}>No tracked accounts currently have an Unbound Crow or Unbound Shadow.</p>
        ) : (
          <div className="space-y-2">
            {pending.map((match) => {
              const status = rowStatus[match.user_id] ?? "idle";
              return (
                <div
                  key={`${match.user_id}-${match.secret}`}
                  className="rounded-lg border border-zinc-200 bg-zinc-50 px-3 py-2 text-sm dark:border-white/5 dark:bg-white/[0.04]"
                >
                  <div className="flex items-center justify-between gap-2">
                    <div className="min-w-0">
                      <span className="font-medium">{match.display_name || match.username}</span>{" "}
                      <span className="text-xs text-zinc-500 dark:text-zinc-400">@{match.username}</span>
                      <span className="ml-2 rounded-full bg-fuchsia-100 px-2 py-0.5 text-[11px] font-semibold text-fuchsia-700 dark:bg-fuchsia-500/15 dark:text-fuchsia-400">
                        Unbound {match.secret}
                      </span>
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
                    <button
                      onClick={() => swapOne(match)}
                      disabled={status === "swapping" || runningAll}
                      className="shrink-0 rounded-md border border-fuchsia-300 bg-white px-2.5 py-1 text-xs font-semibold text-fuchsia-600 transition-colors hover:border-fuchsia-400 disabled:cursor-not-allowed disabled:opacity-50 dark:border-fuchsia-500/40 dark:bg-white/5 dark:text-fuchsia-400"
                    >
                      {status === "swapping"
                        ? "Swapping…"
                        : status === "error" || status === "not_fired"
                          ? "Retry"
                          : "Swap now"}
                    </button>
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
    </div>
  );
}
