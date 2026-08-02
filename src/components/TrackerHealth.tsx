import { useEffect, useMemo, useState } from "react";

const ONLINE_WINDOW_MS = 3 * 60 * 1000;

function ageLabel(iso: string, now: number): string {
  const seconds = Math.max(0, Math.floor((now - new Date(iso).getTime()) / 1000));
  if (seconds < 10) return "just now";
  if (seconds < 60) return `${seconds}s ago`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  return `${Math.floor(minutes / 60)}h ago`;
}

/** A lightweight, client-side health signal for the currently loaded tracker rows. */
export function TrackerHealth({ reports }: { reports: Array<{ last_seen: string }> }) {
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 15_000);
    return () => window.clearInterval(timer);
  }, []);

  const health = useMemo(() => {
    const valid = reports.filter((report) => Number.isFinite(new Date(report.last_seen).getTime()));
    const reporting = valid.filter((report) => now - new Date(report.last_seen).getTime() < ONLINE_WINDOW_MS).length;
    const newest = valid.reduce<string | null>((latest, report) => {
      return !latest || new Date(report.last_seen).getTime() > new Date(latest).getTime() ? report.last_seen : latest;
    }, null);
    return { reporting, newest };
  }, [reports, now]);

  if (reports.length === 0) return null;

  const healthy = health.reporting > 0;
  return (
    <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-zinc-500 dark:text-zinc-400" aria-live="polite">
      <span className={`size-2 rounded-full ${healthy ? "bg-emerald-500" : "bg-amber-400"}`} />
      <span className="font-medium text-zinc-700 dark:text-zinc-200">Live tracker</span>
      <span>{health.reporting} of {reports.length} loaded accounts reported within 3 minutes.</span>
      {health.newest && <span>Latest report {ageLabel(health.newest, now)}.</span>}
    </div>
  );
}
