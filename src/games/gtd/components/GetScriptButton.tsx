import { buildTrackerScript } from "../lib/trackerScript";
import { useToast } from "../../../components/Toast";

/** Header button: copies the GTD tracker script straight to the clipboard. No per-user token to fetch — gtd_accounts is a fully open collection (see kirayu-server/README.md). */
export function GetScriptButton() {
  const toast = useToast();

  async function copyScript() {
    await navigator.clipboard.writeText(buildTrackerScript());
    toast.success("Copied!", "Paste it into your Roblox executor while Garden Tower Defense is open, then run it.");
  }

  return (
    <button
      onClick={copyScript}
      className="rounded-full px-3.5 py-1.5 text-sm font-medium text-zinc-500 transition-colors hover:bg-zinc-100 hover:text-zinc-900 dark:text-zinc-400 dark:hover:bg-white/5 dark:hover:text-white"
    >
      Get script
    </button>
  );
}
