import { ClientResponseError } from "pocketbase";
import { pb } from "../../../lib/pocketbase";

/**
 * Client for AccountOps (accountops.org), the third-party device-farm
 * service the user's AE farming accounts run on. Routed through the
 * `/api/ae/accountops-proxy` PocketBase hook — AccountOps sends no CORS
 * headers for our origin, so a direct browser request would fail anyway.
 * The API key is a stable long-lived credential (not a short session token
 * like Eldorado/ZeusX), kept in this browser's localStorage only — never
 * sent anywhere but the proxy.
 */

const KEYS = {
  apiKey: "accountops.apiKey",
  crowOption: "accountops.crowOption",
  shadowOption: "accountops.shadowOption",
  bothOption: "accountops.bothOption",
} as const;

export function getAccountOpsApiKey(): string {
  return localStorage.getItem(KEYS.apiKey) ?? "";
}

export function saveAccountOpsApiKey(rawKey: string): void {
  const key = rawKey.trim();
  if (!key) throw new Error("Paste an AccountOps API key first.");
  localStorage.setItem(KEYS.apiKey, key);
}

export function clearAccountOpsApiKey(): void {
  localStorage.removeItem(KEYS.apiKey);
}

export interface AutoswapOptions {
  /** Autoswap rule number (the Autoswap page's "option") for the Unbound Crow output folder. */
  crow: number | null;
  /** Autoswap rule number for the Unbound Shadow output folder. */
  shadow: number | null;
  /** Autoswap rule number for accounts with BOTH at once — a separate, higher-value output folder. Falls back to the Crow rule if unset. */
  both: number | null;
}

export function getAutoswapOptions(): AutoswapOptions {
  const crow = Number(localStorage.getItem(KEYS.crowOption));
  const shadow = Number(localStorage.getItem(KEYS.shadowOption));
  const both = Number(localStorage.getItem(KEYS.bothOption));
  return {
    crow: Number.isFinite(crow) && crow > 0 ? crow : null,
    shadow: Number.isFinite(shadow) && shadow > 0 ? shadow : null,
    both: Number.isFinite(both) && both > 0 ? both : null,
  };
}

export function saveAutoswapOptions(options: AutoswapOptions): void {
  if (options.crow != null) localStorage.setItem(KEYS.crowOption, String(options.crow));
  else localStorage.removeItem(KEYS.crowOption);
  if (options.shadow != null) localStorage.setItem(KEYS.shadowOption, String(options.shadow));
  else localStorage.removeItem(KEYS.shadowOption);
  if (options.both != null) localStorage.setItem(KEYS.bothOption, String(options.both));
  else localStorage.removeItem(KEYS.bothOption);
}

interface ProxyOptions {
  json?: unknown;
}

async function accountOpsRequest<T>(path: string, options: ProxyOptions = {}): Promise<T> {
  const apiKey = getAccountOpsApiKey();
  if (!apiKey) throw new Error("AccountOps is not connected. Add your API key in Autoswap Settings.");

  try {
    return await pb.send<T>("/api/ae/accountops-proxy", {
      method: "POST",
      body: { path, apiKey, json: options.json },
    });
  } catch (err) {
    if (err instanceof ClientResponseError) {
      const body = err.response as { error?: string } | undefined;
      throw new Error(body?.error || err.message || "AccountOps request failed.");
    }
    throw err;
  }
}

export type AutoswapOutcome = "swapped" | "moved" | "not_fired";

export interface AutoswapResult {
  outcome: AutoswapOutcome;
  replacement?: string;
}

/**
 * Fires one autoswap rule on `username` right now: the account moves to the
 * rule's output folder and a replacement (if one is available in the rule's
 * input folder) takes its device slot. `not_fired` means nothing changed
 * (wrong option, rule paused, or no replacement free) — per AccountOps'
 * docs this is safe to retry, not an error.
 */
export async function autoswapComplete(username: string, option: number): Promise<AutoswapResult> {
  return accountOpsRequest<AutoswapResult>("accounts/autoswap-complete", { json: { username, option } });
}

export interface AccountOpsDeviceAccount {
  id: number;
  username: string;
  enabled: boolean;
  tags: string[];
}

export interface AccountOpsDevice {
  device_id: string;
  nickname: string;
  online: boolean;
  accounts: AccountOpsDeviceAccount[];
}

/** Optional visibility query — not required for the autoswap flow, but useful for confirming a device/account exists. */
export async function queryDeviceAccounts(filters: {
  online_only?: boolean;
  enabled_only?: boolean;
  tag?: string;
  device_ids?: string[];
}): Promise<{ devices: AccountOpsDevice[] }> {
  return accountOpsRequest("devices/accounts", { json: filters });
}
