import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { useGtdAccounts, realAccounts } from "../hooks/useGtdAccounts";
import { useSummonConfigs, useSaveSummonConfig } from "../hooks/useSummonConfigs";
import { useShopUnits } from "../hooks/useShopUnits";
import { SUMMON_BOXES, SUMMON_BOX_MAP } from "../data/summonBoxes";
import { unitRarity } from "../lib/unitRarity";
import { formatNumber, isOnline, prettifyUnitId } from "../lib/format";
import { UnitCardMini } from "../components/UnitCardMini";
import type { GtdAccount, SummonConfig, TradeItem } from "../lib/types";

const DEFAULT_BOX = "Greenhouse Summon";

function isParked(acc: GtdAccount | undefined | null): boolean {
  return !!(acc && acc.parked_job_id && isOnline(acc));
}

function ownedUnits(acc: GtdAccount | undefined) {
  if (!acc) return [];
  return (acc.inventory ?? [])
    .filter((i) => i && i.id?.startsWith("unit_") && (i.count ?? 0) > 0)
    .map((i) => ({ id: i.id, name: i.name || i.id, count: i.count ?? 0, image: i.image || null, rarity: unitRarity(i.id) }))
    .sort((a, b) => a.name.localeCompare(b.name));
}

export default function AutomationPage() {
  const [params] = useSearchParams();
  const { data: accounts } = useGtdAccounts();
  const { data: configs } = useSummonConfigs();
  const { data: shopUnits } = useShopUnits();
  const save = useSaveSummonConfig();

  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<string | null>(null);

  useEffect(() => {
    const u = params.get("u");
    if (u) setSelected(u);
  }, [params]);

  const cfg: Partial<SummonConfig> = useMemo(
    () => configs?.find((c) => c.username === selected) ?? {},
    [configs, selected],
  );
  const acc = accounts?.find((a) => a.username === selected);

  // ── Summon column state ──
  const [loopSummon, setLoopSummon] = useState(false);
  const [summonBox, setSummonBox] = useState(DEFAULT_BOX);
  const [stopAt, setStopAt] = useState(0);
  const [bannedUnits, setBannedUnits] = useState<Set<string>>(new Set());

  // ── Buy column state ──
  const [autoBuy, setAutoBuy] = useState(false);
  const [buyUnits, setBuyUnits] = useState<Set<string>>(new Set());
  const [buySearch, setBuySearch] = useState("");
  const [customBuyInput, setCustomBuyInput] = useState("");

  // ── Trade column state ──
  const [autoTrade, setAutoTrade] = useState(false);
  const [tradeTarget, setTradeTarget] = useState("");
  const [joinServerInput, setJoinServerInput] = useState("");
  const [tradeItems, setTradeItems] = useState<TradeItem[]>([]);
  const [stagedUnitIds, setStagedUnitIds] = useState<Set<string>>(new Set());
  const [tradeAddSearch, setTradeAddSearch] = useState("");
  const [tradeAddAmount, setTradeAddAmount] = useState(1);

  // (Re)initialize the whole form whenever the selected account (or its config) changes.
  useEffect(() => {
    if (!selected) return;
    const box = SUMMON_BOX_MAP.get(cfg.summon_box || DEFAULT_BOX) ? cfg.summon_box || DEFAULT_BOX : DEFAULT_BOX;
    setSummonBox(box);
    setLoopSummon(!!cfg.loop_summon);
    setStopAt(cfg.stop_summon_at || 0);
    const boxDef = SUMMON_BOX_MAP.get(box);
    setBannedUnits(new Set(Array.isArray(cfg.banned_units) ? cfg.banned_units : boxDef ? boxDef.units.map((u) => u.id) : []));

    setAutoBuy(!!cfg.auto_buy);
    setBuyUnits(new Set(Array.isArray(cfg.buy_units) ? cfg.buy_units : []));
    setBuySearch("");

    setAutoTrade(!!cfg.auto_trade);
    setTradeTarget(cfg.trade_target || "");
    const parkedAcc = accounts?.find((a) => a.parked_job_id === cfg.trade_target_job_id);
    setJoinServerInput(cfg.trade_target_job_id && parkedAcc ? parkedAcc.username : "");
    setTradeItems(Array.isArray(cfg.trade_items) ? cfg.trade_items.map((i) => ({ ...i })) : []);
    setStagedUnitIds(new Set());
    setTradeAddSearch("");
    setTradeAddAmount(1);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selected, cfg.summon_box, cfg.loop_summon, cfg.stop_summon_at, cfg.auto_buy, cfg.auto_trade]);

  function onBoxChange(name: string) {
    setSummonBox(name);
    const box = SUMMON_BOX_MAP.get(name);
    setBannedUnits(new Set(box ? box.units.map((u) => u.id) : []));
  }

  const box = SUMMON_BOX_MAP.get(summonBox);
  const inv = ownedUnits(acc);

  const tradeAddMax = useMemo(() => {
    const counts = [...stagedUnitIds].map((id) => inv.find((i) => i.id === id)?.count ?? 1);
    return counts.length > 0 ? Math.max(1, Math.min(...counts)) : 1;
  }, [stagedUnitIds, inv]);
  useEffect(() => {
    setTradeAddAmount((v) => Math.min(v || tradeAddMax, tradeAddMax));
  }, [tradeAddMax]);

  const accountList = useMemo(() => {
    const real = realAccounts(accounts ?? []);
    const q = search.trim().toLowerCase();
    const filtered = q ? real.filter((a) => a.username.toLowerCase().includes(q)) : real;
    return [...filtered].sort((a, b) => a.username.localeCompare(b.username));
  }, [accounts, search]);

  const parkedCandidates = useMemo(() => {
    const q = joinServerInput.toLowerCase().trim();
    return realAccounts(accounts ?? [])
      .filter((a) => a.username !== selected && isParked(a))
      .filter((a) => !q || a.username.toLowerCase().includes(q))
      .sort((a, b) => a.username.localeCompare(b.username))
      .slice(0, 50);
  }, [accounts, joinServerInput, selected]);

  const joinServerAcc = accounts?.find((a) => a.username === joinServerInput.trim());

  function saveSummon() {
    if (!selected) return;
    save.mutate({
      username: selected,
      patch: {
        summon_box: summonBox,
        loop_summon: loopSummon,
        summon_amount: 10,
        stop_summon_at: Math.max(0, stopAt || 0),
        banned_units: Array.from(bannedUnits),
      },
    });
  }

  function saveBuy() {
    if (!selected) return;
    save.mutate({ username: selected, patch: { auto_buy: autoBuy, buy_units: Array.from(buyUnits) } });
  }

  function saveTrade() {
    if (!selected) return;
    save.mutate({
      username: selected,
      patch: {
        auto_trade: autoTrade,
        trade_target: tradeTarget.trim(),
        trade_target_job_id: isParked(joinServerAcc) ? joinServerAcc!.parked_job_id : "",
        trade_items: tradeItems,
      },
    });
  }

  function addStagedToTradeItems() {
    if (stagedUnitIds.size === 0) return;
    const amount = Math.max(1, tradeAddAmount || 1);
    setTradeItems((prev) => {
      let next = prev;
      stagedUnitIds.forEach((unitId) => {
        const owned = inv.find((i) => i.id === unitId);
        const amt = owned ? Math.min(amount, owned.count) : amount;
        next = [...next.filter((i) => i.unit_id !== unitId), { unit_id: unitId, amount: amt }];
      });
      return next;
    });
    setStagedUnitIds(new Set());
    setTradeAddSearch("");
  }

  return (
    <div className="wrap" style={{ padding: 0 }}>
      <div className="panel toolbar">
        <div className="search-box">
          <span>🔍</span>
          <input type="text" placeholder="Search username..." value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
      </div>

      <div className="summon-layout">
        <div className="panel">
          <div className="holders-list" style={{ padding: 10 }}>
            {accountList.length === 0 ? (
              <div className="empty-state">
                <span className="big-emoji">🤖</span>No accounts match.
              </div>
            ) : (
              accountList.map((a) => {
                const config = configs?.find((c) => c.username === a.username);
                const online = isOnline(a);
                return (
                  <div
                    key={a.id}
                    className={`holder-row ${a.username === selected ? "selected" : ""}`}
                    onClick={() => setSelected(a.username)}
                  >
                    <span className={`status-dot ${online ? "" : "offline"}`} />
                    <span className="holder-name">{a.username}</span>
                    <span className={`badge ${config?.auto_buy ? "on" : ""}`}>{config?.auto_buy ? "Buying" : "Idle"}</span>
                  </div>
                );
              })
            )}
          </div>
        </div>

        <div className="panel holders-panel">
          {!selected ? (
            <div className="holders-empty">
              <span className="big-emoji">🤖</span>
              Select an account to see its summon and buy options.
            </div>
          ) : (
            <div>
              <div className="holders-header">
                <span className={`status-dot ${acc && isOnline(acc) ? "" : "offline"}`} />
                <div className="holders-name">{selected}</div>
              </div>
              <div className="holders-divider" />

              <div className="triple-columns">
                {/* ── Summon ── */}
                <div className="option-col">
                  <div className="holders-meta-label" style={{ marginBottom: 8 }}>
                    Summon
                  </div>
                  <div className="form-field">
                    <label>Loop Summon</label>
                    <button className={`pill toggle-btn ${loopSummon ? "green" : "grey"}`} onClick={() => setLoopSummon((v) => !v)}>
                      {loopSummon ? "On" : "Off"}
                    </button>
                  </div>
                  <div className="form-field">
                    <label>Summon Box</label>
                    <select value={summonBox} onChange={(e) => onBoxChange(e.target.value)}>
                      {SUMMON_BOXES.map((b) => (
                        <option key={b.name} value={b.name}>
                          {b.name}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="form-field">
                    <label>
                      Units to Ban <span className="field-hint">{box ? `${bannedUnits.size}/${box.units.length} banned` : ""}</span>
                    </label>
                    <div className="quick-actions">
                      <button className="pill red" onClick={() => setBannedUnits(new Set(box ? box.units.map((u) => u.id) : []))}>
                        Ban All
                      </button>
                      <button className="pill green" onClick={() => setBannedUnits(new Set())}>
                        Allow All
                      </button>
                    </div>
                    <div className="unit-card-grid">
                      {box?.units.map((u) => {
                        const banned = bannedUnits.has(u.id);
                        return (
                          <UnitCardMini
                            key={u.id}
                            unitId={u.id}
                            name={u.name}
                            rarity={unitRarity(u.id)}
                            statusIcon={banned ? "🚫" : "✓"}
                            statusClass={banned ? "banned" : "selected"}
                            onClick={() =>
                              setBannedUnits((prev) => {
                                const next = new Set(prev);
                                if (next.has(u.id)) next.delete(u.id);
                                else next.add(u.id);
                                return next;
                              })
                            }
                          />
                        );
                      })}
                    </div>
                  </div>
                  <button className="pill green save-btn" onClick={saveSummon} disabled={save.isPending}>
                    Save Summon
                  </button>
                </div>

                {/* ── Buy ── */}
                <div className="option-col">
                  <div className="holders-meta-label" style={{ marginBottom: 8 }}>
                    Buy
                  </div>
                  <div className="form-field">
                    <label>Auto Buy</label>
                    <button className={`pill toggle-btn ${autoBuy ? "green" : "grey"}`} onClick={() => setAutoBuy((v) => !v)}>
                      {autoBuy ? "On" : "Off"}
                    </button>
                  </div>
                  <div className="form-field">
                    <label>
                      Units to Buy <span className="field-hint">{buyUnits.size > 0 ? `${buyUnits.size} selected` : ""}</span>
                    </label>
                    <div className="chip-list">
                      {Array.from(buyUnits).map((id) => {
                        const u = shopUnits?.find((s) => s.unit_id === id);
                        return (
                          <span
                            key={id}
                            className="chip"
                            onClick={() =>
                              setBuyUnits((prev) => {
                                const next = new Set(prev);
                                next.delete(id);
                                return next;
                              })
                            }
                          >
                            {u ? u.name : prettifyUnitId(id)} <span className="remove">✕</span>
                          </span>
                        );
                      })}
                    </div>
                    <div className="unit-picker">
                      <input
                        type="text"
                        className="unit-picker-search"
                        placeholder="Search shop units..."
                        value={buySearch}
                        onChange={(e) => setBuySearch(e.target.value)}
                      />
                      <div className="unit-card-grid">
                        {(shopUnits ?? [])
                          .filter((u) => !buySearch || u.name.toLowerCase().includes(buySearch.toLowerCase()) || u.unit_id.toLowerCase().includes(buySearch.toLowerCase()))
                          .map((u) => {
                            const queued = buyUnits.has(u.unit_id);
                            return (
                              <UnitCardMini
                                key={u.unit_id}
                                unitId={u.unit_id}
                                name={u.name}
                                rarity={unitRarity(u.unit_id)}
                                statusIcon={queued ? "✓" : "+"}
                                statusClass={queued ? "selected" : ""}
                                badge={u.price > 0 ? <div className="qty-badge">{formatNumber(u.price)}🌱</div> : undefined}
                                onClick={() =>
                                  setBuyUnits((prev) => {
                                    const next = new Set(prev);
                                    if (next.has(u.unit_id)) next.delete(u.unit_id);
                                    else next.add(u.unit_id);
                                    return next;
                                  })
                                }
                              />
                            );
                          })}
                      </div>
                    </div>
                    <div className="manual-add-row">
                      <input
                        type="text"
                        placeholder='Add unit ID e.g. "stunia"'
                        value={customBuyInput}
                        onChange={(e) => setCustomBuyInput(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key !== "Enter") return;
                          const raw = customBuyInput.trim().toLowerCase().replace(/\s+/g, "_");
                          if (!raw) return;
                          const unitId = raw.startsWith("unit_") ? raw : `unit_${raw}`;
                          setBuyUnits((prev) => new Set(prev).add(unitId));
                          setCustomBuyInput("");
                        }}
                      />
                      <button
                        className="pill blue"
                        onClick={() => {
                          const raw = customBuyInput.trim().toLowerCase().replace(/\s+/g, "_");
                          if (!raw) return;
                          const unitId = raw.startsWith("unit_") ? raw : `unit_${raw}`;
                          setBuyUnits((prev) => new Set(prev).add(unitId));
                          setCustomBuyInput("");
                        }}
                      >
                        +
                      </button>
                    </div>
                  </div>
                  <button className="pill green save-btn" onClick={saveBuy} disabled={save.isPending}>
                    Save Buy
                  </button>
                </div>

                {/* ── Trade ── */}
                <div className="option-col">
                  <div className="holders-meta-label" style={{ marginBottom: 8 }}>
                    Trade
                  </div>
                  <div className="form-field">
                    <label>Auto Trade</label>
                    <button className={`pill toggle-btn ${autoTrade ? "green" : "grey"}`} onClick={() => setAutoTrade((v) => !v)}>
                      {autoTrade ? "On" : "Off"}
                    </button>
                  </div>
                  <div className="form-field">
                    <label>
                      Target Username <span className="field-hint">(who receives the trade)</span>
                    </label>
                    <input
                      type="text"
                      placeholder="Roblox username to trade with"
                      value={tradeTarget}
                      onChange={(e) => setTradeTarget(e.target.value)}
                    />
                  </div>
                  <div className="form-field">
                    <label>
                      Join Server <span className="field-hint">(parked account to meet at — independent of target)</span>
                    </label>
                    <div className="unit-picker">
                      <input
                        type="text"
                        className="unit-picker-search"
                        placeholder="Search parked accounts..."
                        value={joinServerInput}
                        onChange={(e) => setJoinServerInput(e.target.value)}
                      />
                      <div className="unit-picker-list">
                        {parkedCandidates.length === 0 ? (
                          <div className="empty-state" style={{ padding: "14px 10px" }}>
                            No parked accounts right now — run lobby_parker.lua on one first.
                          </div>
                        ) : (
                          parkedCandidates.map((a) => (
                            <label key={a.id} className="unit-picker-row" onClick={() => setJoinServerInput(a.username)}>
                              <span className="status-dot" style={{ animation: "none" }} />
                              <span>{a.username}</span>
                              <span className="badge on" style={{ marginLeft: "auto" }}>
                                📍 Parked
                              </span>
                            </label>
                          ))
                        )}
                      </div>
                    </div>
                    <span className="field-hint" style={{ display: "block", marginTop: 6, color: joinServerInput.trim() ? (isParked(joinServerAcc) ? "var(--green)" : "var(--red)") : undefined }}>
                      {!joinServerInput.trim()
                        ? "None selected — bot will hop servers randomly if needed."
                        : isParked(joinServerAcc)
                          ? `✓ Will join ${joinServerAcc!.username}'s parked server directly.`
                          : "⚠ Not currently parked/online — falls back to random hop."}
                    </span>
                  </div>
                  <div className="form-field">
                    <label>
                      Items to Send <span className="field-hint">{tradeItems.length > 0 ? `(${tradeItems.length})` : ""}</span>
                    </label>
                    <div className="chip-list">
                      {tradeItems.map((item) => {
                        const known = inv.find((u) => u.id === item.unit_id);
                        return (
                          <span
                            key={item.unit_id}
                            className="chip violet"
                            onClick={() => setTradeItems((prev) => prev.filter((i) => i.unit_id !== item.unit_id))}
                          >
                            {known ? known.name : prettifyUnitId(item.unit_id)} <span style={{ opacity: 0.7 }}>×{item.amount}</span>{" "}
                            <span className="remove">✕</span>
                          </span>
                        );
                      })}
                    </div>
                  </div>
                  <div className="form-field">
                    <label>Add Item</label>
                    <div className="chip-list">
                      {Array.from(stagedUnitIds).map((id) => {
                        const u = inv.find((i) => i.id === id);
                        return (
                          <span
                            key={id}
                            className="chip violet"
                            onClick={() =>
                              setStagedUnitIds((prev) => {
                                const next = new Set(prev);
                                next.delete(id);
                                return next;
                              })
                            }
                          >
                            {u ? u.name : prettifyUnitId(id)} <span className="remove">✕</span>
                          </span>
                        );
                      })}
                    </div>
                    <div className="unit-picker">
                      <input
                        type="text"
                        className="unit-picker-search"
                        placeholder="Search owned units..."
                        value={tradeAddSearch}
                        onChange={(e) => setTradeAddSearch(e.target.value)}
                      />
                      <div className="unit-card-grid">
                        {inv.length === 0 ? (
                          <div className="empty-state" style={{ padding: "20px 10px" }}>
                            No units in this account&apos;s inventory.
                          </div>
                        ) : (
                          inv
                            .filter((u) => !tradeAddSearch || u.name.toLowerCase().includes(tradeAddSearch.toLowerCase()) || u.id.toLowerCase().includes(tradeAddSearch.toLowerCase()))
                            .map((u) => {
                              const staged = stagedUnitIds.has(u.id);
                              return (
                                <UnitCardMini
                                  key={u.id}
                                  unitId={u.id}
                                  name={u.name}
                                  rarity={u.rarity}
                                  image={u.image}
                                  statusIcon={staged ? "✓" : "+"}
                                  statusClass={staged ? "selected" : ""}
                                  badge={<div className="qty-badge">×{formatNumber(u.count)}</div>}
                                  onClick={() =>
                                    setStagedUnitIds((prev) => {
                                      const next = new Set(prev);
                                      if (next.has(u.id)) next.delete(u.id);
                                      else next.add(u.id);
                                      return next;
                                    })
                                  }
                                />
                              );
                            })
                        )}
                      </div>
                    </div>
                    <div className="trade-add-row">
                      <input
                        type="range"
                        min={1}
                        max={tradeAddMax}
                        value={tradeAddAmount}
                        onChange={(e) => setTradeAddAmount(Number(e.target.value))}
                      />
                      <span className="trade-add-amount-value">{tradeAddAmount}</span>
                      <button className="pill blue" disabled={stagedUnitIds.size === 0} onClick={addStagedToTradeItems}>
                        Add to List
                      </button>
                    </div>
                  </div>
                  <button className="pill green save-btn" onClick={saveTrade} disabled={save.isPending}>
                    Save Trade
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
