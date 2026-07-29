import type { AutoswapOutcome } from "./accountops";

/**
 * Tracks which tracked accounts have already had an AccountOps autoswap
 * fired for their Unbound Crow/Shadow, so the Autoswap page's pending list
 * doesn't keep offering to re-swap an account whose tracker data hasn't
 * refreshed yet. Stored in this browser's localStorage only — a local
 * reminder, not a source of truth synced across devices.
 */

export type UnboundSecret = "Crow" | "Shadow";

/** One secret + the trait that made it swap-worthy — an account swapped for "Both" gets one part per secret, each with its own trait. */
export interface AutoswapPart {
  secret: UnboundSecret;
  trait: string;
}

export interface AutoswapRecord {
  /** One part for a single-secret swap; two for a "Both" swap (one per secret). */
  parts: AutoswapPart[];
  outcome: AutoswapOutcome;
  at: string;
}

/** "Unbound Crow" / "Unbound Crow + Unbound Shadow" — the exact string shown in badges and used as the filter dropdown's value. */
export function formatAutoswapParts(parts: AutoswapPart[] | undefined): string {
  if (!parts || parts.length === 0) return "—";
  return parts.map((p) => `${p.trait} ${p.secret}`).join(" + ");
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

export function markAutoswapped(userId: number, parts: AutoswapPart[], outcome: AutoswapOutcome): void {
  const all = readAll();
  all[String(userId)] = { parts, outcome, at: new Date().toISOString() };
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
