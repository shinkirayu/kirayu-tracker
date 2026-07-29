import type { AutoswapOutcome } from "./accountops";

/**
 * Tracks which tracked accounts have already had an AccountOps autoswap
 * fired for their Unbound Crow/Shadow, so the Autoswap page's pending list
 * doesn't keep offering to re-swap an account whose tracker data hasn't
 * refreshed yet. Stored in this browser's localStorage only — a local
 * reminder, not a source of truth synced across devices.
 */

export type UnboundSecret = "Crow" | "Shadow";

interface AutoswapRecord {
  secret: UnboundSecret;
  outcome: AutoswapOutcome;
  at: string;
}

const STORAGE_KEY = "autoswapHistory";

function readAll(): Record<string, AutoswapRecord> {
  try {
    const data = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "{}");
    return data && typeof data === "object" ? data : {};
  } catch {
    return {};
  }
}

function writeAll(all: Record<string, AutoswapRecord>): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(all));
}

export function getAutoswapRecord(userId: number): AutoswapRecord | null {
  return readAll()[String(userId)] ?? null;
}

export function isAlreadyAutoswapped(userId: number): boolean {
  return !!getAutoswapRecord(userId);
}

export function markAutoswapped(userId: number, secret: UnboundSecret, outcome: AutoswapOutcome): void {
  const all = readAll();
  all[String(userId)] = { secret, outcome, at: new Date().toISOString() };
  writeAll(all);
}

export function clearAutoswapRecord(userId: number): void {
  const all = readAll();
  delete all[String(userId)];
  writeAll(all);
}
