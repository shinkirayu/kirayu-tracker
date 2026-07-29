import type { AutoswapOutcome } from "./accountops";

/**
 * Tracks which tracked accounts have already had an AccountOps autoswap
 * fired for their Unbound Crow/Shadow, so the Autoswap page's pending list
 * doesn't keep offering to re-swap an account whose tracker data hasn't
 * refreshed yet. Stored in this browser's localStorage only — a local
 * reminder, not a source of truth synced across devices.
 */

export type UnboundSecret = "Crow" | "Shadow";
/** "Both" — a distinct autoswap rule/folder for accounts that have both at once, higher-value than either alone. */
export type UnboundLabel = UnboundSecret | "Both";

export interface AutoswapRecord {
  secret: UnboundLabel;
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

/** Every account with local autoswap history, keyed by user_id (as a string, matching the storage key). */
export function getAllAutoswapRecords(): Record<string, AutoswapRecord> {
  return readAll();
}

export function isAlreadyAutoswapped(userId: number): boolean {
  return !!getAutoswapRecord(userId);
}

export function markAutoswapped(userId: number, secret: UnboundLabel, outcome: AutoswapOutcome): void {
  const all = readAll();
  all[String(userId)] = { secret, outcome, at: new Date().toISOString() };
  writeAll(all);
}

export function clearAutoswapRecord(userId: number): void {
  const all = readAll();
  delete all[String(userId)];
  writeAll(all);
}

/** Wipes all local autoswap bookkeeping — every account currently matching Unbound Crow/Shadow reappears as pending. */
export function clearAllAutoswapHistory(): void {
  localStorage.removeItem(STORAGE_KEY);
}
