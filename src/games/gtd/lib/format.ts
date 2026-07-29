import type { GtdAccount } from "./types";

export const ONLINE_WINDOW_MS = 5 * 60 * 1000;

export function isOnline(acc: Pick<GtdAccount, "updated_at">): boolean {
  const age = Date.now() - new Date(acc.updated_at).getTime();
  return age <= ONLINE_WINDOW_MS;
}

export function formatNumber(n: number | null | undefined): string {
  return Math.floor(n || 0).toLocaleString("en-US");
}

export function formatSigned(n: number | null | undefined): string {
  const v = Math.floor(n || 0);
  return (v > 0 ? "+" : "") + v.toLocaleString("en-US");
}

export function formatAge(acc: Pick<GtdAccount, "updated_at">): string {
  const age = Math.floor((Date.now() - new Date(acc.updated_at).getTime()) / 1000);
  if (age <= 0) return "now";
  if (age < 60) return age + "s ago";
  if (age < 3600) return Math.floor(age / 60) + "m ago";
  if (age < 86400) return Math.floor(age / 3600) + "h ago";
  return Math.floor(age / 86400) + "d ago";
}

/**
 * Always the browser's LOCAL calendar date, never UTC — using UTC previously
 * made "today" roll over at UTC midnight, which shows up as the seeds-today
 * reset happening at noon (or whatever local time UTC midnight lands on)
 * instead of this device's actual local 12am.
 */
export function localDateStr(d: Date = new Date()): string {
  const tzOffsetMs = d.getTimezoneOffset() * 60000;
  return new Date(d.getTime() - tzOffsetMs).toISOString().split("T")[0];
}

export function prettifyUnitId(id: string): string {
  return String(id || "")
    .replace(/^unit_/, "")
    .replace(/_/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());
}
