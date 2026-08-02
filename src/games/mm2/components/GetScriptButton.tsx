import { useRegenerateTrackerToken, useTrackerToken } from "../hooks/useTrackerToken";
import { buildTrackerScript, TRACKER_VERSION } from "../lib/trackerScript";
import { useToast } from "../../../components/Toast";

const POCKETBASE_URL = import.meta.env.VITE_POCKETBASE_URL as string;

/** Header button: copies the tracker script straight to the clipboard, no modal in the way. */
export function GetScriptButton() {
  const { data: token, isLoading } = useTrackerToken();
  const regenerate = useRegenerateTrackerToken();
  const toast = useToast();

  async function copyScript() {
    if (!token) return;
    const endpoint = `${POCKETBASE_URL}/api/mm2/ingest?key=${token}`;
    try {
      await navigator.clipboard.writeText(buildTrackerScript(endpoint));
      toast.success(`Tracker v${TRACKER_VERSION} copied`, "Paste it into your Roblox executor while Murder Mystery 2 is open, then run it.");
    } catch (error) {
      toast.error("Couldn't copy the script", error instanceof Error ? error.message : "Allow clipboard access and try again.");
    }
  }

  function regenerateToken() {
    const ok = window.confirm(
      "Regenerate your tracker token?\n\nAny script already running with the old token will stop reporting until you copy and re-paste the new one.",
    );
    if (!ok) return;
    regenerate.mutate(undefined, {
      onSuccess: () => toast.success("Token regenerated", "Click Get script again to copy the new one."),
      onError: (err) => toast.error("Couldn't regenerate token", (err as Error).message),
    });
  }

  return (
    <div className="flex items-center gap-1">
      <button
        onClick={copyScript}
        disabled={isLoading || !token}
        className="rounded-full px-3.5 py-1.5 text-sm font-medium text-zinc-500 transition-colors hover:bg-zinc-100 hover:text-zinc-900 disabled:opacity-50 dark:text-zinc-400 dark:hover:bg-white/5 dark:hover:text-white"
      >
        {isLoading ? "Loading…" : "Get script"}
      </button>
      <button
        onClick={regenerateToken}
        disabled={regenerate.isPending}
        title="Regenerate tracker token"
        aria-label="Regenerate tracker token"
        className="rounded-full p-2 text-zinc-400 transition-colors hover:bg-zinc-100 hover:text-zinc-900 disabled:opacity-50 dark:hover:bg-white/5 dark:hover:text-white"
      >
        ⟳
      </button>
    </div>
  );
}
