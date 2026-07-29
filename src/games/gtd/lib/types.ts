export interface InventoryItem {
  id: string;
  name: string;
  image: string;
  count: number;
}

/** Row shape mirrors kirayu-server's gtd_accounts collection. */
export interface GtdAccount {
  id: string;
  username: string;
  seeds: number;
  lucky_blocks: number;
  units: number;
  lobby: string;
  status: string;
  x2_seeds: boolean;
  x3_speed: boolean;
  inventory: InventoryItem[];
  action: string;
  parked_job_id: string;
  games_won: number;
  wave: number;
  updated_at: string;
}

export interface ShopUnit {
  id: string;
  unit_id: string;
  name: string;
  price: number;
}

export interface TradeItem {
  unit_id: string;
  amount: number;
}

/** Row shape mirrors kirayu-server's gtd_summon_config collection. */
export interface SummonConfig {
  id: string;
  username: string;
  loop_summon: boolean;
  summon_box: string;
  summon_amount: number;
  stop_summon_at: number;
  banned_units: string[];
  auto_buy: boolean;
  buy_units: string[];
  auto_trade: boolean;
  trade_target: string;
  trade_target_job_id: string;
  trade_items: TradeItem[];
}

export type Rarity = "common" | "uncommon" | "rare" | "epic" | "legendary" | "godly" | "exclusive";

export interface AggregatedUnit {
  key: string;
  name: string;
  rarity: Rarity;
  icon: string | null;
  total: number;
  perAccount: { username: string; qty: number }[];
}
