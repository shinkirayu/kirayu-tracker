import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useGtdAccounts } from "../hooks/useGtdAccounts";
import { useAggregatedInventory } from "../hooks/useAggregatedInventory";
import { UnitIcon } from "../components/UnitIcon";
import { RARITY_ORDER, RARITY_STARS, rarityClass } from "../lib/unitRarity";
import { formatNumber, isOnline } from "../lib/format";
import type { AggregatedUnit } from "../lib/types";

function StarsRow({ rarity }: { rarity: string }) {
  const count = RARITY_STARS[rarity as keyof typeof RARITY_STARS] || 0;
  if (count === 0) return null;
  return (
    <div className="stars-row">
      {Array.from({ length: count }, (_, i) => (
        <span key={i} className="star">
          ★
        </span>
      ))}
    </div>
  );
}

export default function InventoryPage() {
  const { data: accounts } = useGtdAccounts();
  const list = useAggregatedInventory(accounts);
  const navigate = useNavigate();

  const [search, setSearch] = useState("");
  const [selectedRarities, setSelectedRarities] = useState<Set<string>>(new Set());
  const [selectedKey, setSelectedKey] = useState<string | null>(null);
  const [selectedHolders, setSelectedHolders] = useState<Set<string>>(new Set());
  const [lastClickedIndex, setLastClickedIndex] = useState<number | null>(null);
  const [copyLabel, setCopyLabel] = useState<string | null>(null);

  const filtered = useMemo(() => {
    let l = list;
    if (search.trim()) {
      const q = search.trim().toLowerCase();
      l = l.filter((i) => i.name.toLowerCase().includes(q));
    }
    if (selectedRarities.size > 0) {
      l = l.filter((i) => selectedRarities.has(i.rarity));
    }
    return [...l].sort(
      (a, b) => (RARITY_STARS[b.rarity] || 0) - (RARITY_STARS[a.rarity] || 0) || b.total - a.total,
    );
  }, [list, search, selectedRarities]);

  const entry: AggregatedUnit | undefined = filtered.find((i) => i.key === selectedKey) ?? list.find((i) => i.key === selectedKey);

  function toggleRarity(r: string) {
    setSelectedRarities((prev) => {
      const next = new Set(prev);
      if (next.has(r)) next.delete(r);
      else next.add(r);
      return next;
    });
  }

  function selectUnit(key: string) {
    setSelectedKey(key);
    setSelectedHolders(new Set());
    setLastClickedIndex(null);
  }

  const holders = useMemo(
    () => (entry ? [...entry.perAccount].sort((a, b) => a.username.localeCompare(b.username)) : []),
    [entry],
  );

  function handleHolderClick(e: React.MouseEvent, idx: number, username: string) {
    if (e.shiftKey && lastClickedIndex !== null) {
      const [start, end] = [lastClickedIndex, idx].sort((a, b) => a - b);
      setSelectedHolders((prev) => {
        const next = new Set(prev);
        for (let i = start; i <= end; i++) next.add(holders[i].username);
        return next;
      });
    } else if (e.ctrlKey || e.metaKey) {
      setSelectedHolders((prev) => {
        const next = new Set(prev);
        if (next.has(username)) next.delete(username);
        else next.add(username);
        return next;
      });
    } else if (selectedHolders.size === 1 && selectedHolders.has(username)) {
      setSelectedHolders(new Set());
    } else {
      setSelectedHolders(new Set([username]));
    }
    setLastClickedIndex(idx);
  }

  async function copyHolders() {
    const chosen = selectedHolders.size > 0 ? holders.filter((h) => selectedHolders.has(h.username)) : holders;
    const text = chosen.map((h) => `${h.username}: x${h.qty}`).join("\n");
    try {
      await navigator.clipboard.writeText(text);
      setCopyLabel("Copied!");
      setTimeout(() => setCopyLabel(null), 1500);
    } catch {
      /* clipboard unavailable */
    }
  }

  function jumpToTrade() {
    const username = [...selectedHolders][0];
    if (!username) return;
    navigate(`/gtd/automation?u=${encodeURIComponent(username)}`);
  }

  return (
    <div className="wrap" style={{ padding: 0 }}>
      <div className="panel toolbar">
        <div className="search-box">
          <span>🔍</span>
          <input type="text" placeholder="Filter units..." value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
        <div className="rarity-pills">
          <button className={`pill ${selectedRarities.size > 0 ? "" : "inactive"}`} data-rarity="all" onClick={() => setSelectedRarities(new Set())}>
            All
          </button>
          {RARITY_ORDER.map((r) => (
            <button
              key={r}
              className={`pill rarity-${r} ${selectedRarities.size > 0 && !selectedRarities.has(r) ? "inactive" : ""}`}
              onClick={() => toggleRarity(r)}
            >
              {r[0].toUpperCase() + r.slice(1)}
            </button>
          ))}
        </div>
      </div>

      <div className="inventory-layout">
        <div className="panel">
          <div className="unit-grid">
            {filtered.length === 0 ? (
              <div className="empty-state" style={{ gridColumn: "1 / -1" }}>
                <span className="big-emoji">🔍</span>No units match.
              </div>
            ) : (
              filtered.map((u) => (
                <div
                  key={u.key}
                  className={`unit-card ${rarityClass(u.rarity)} ${u.key === selectedKey ? "selected" : ""}`}
                  title={`${u.name} — ${u.perAccount.length} account${u.perAccount.length === 1 ? "" : "s"}`}
                  onClick={() => selectUnit(u.key)}
                >
                  <UnitIcon image={u.icon} rawName={u.key} />
                  <StarsRow rarity={u.rarity} />
                  <div className="qty-badge">x{formatNumber(u.total)}</div>
                  <div className="unit-title">{u.name}</div>
                </div>
              ))
            )}
          </div>
        </div>

        <div className="panel holders-panel">
          {!entry ? (
            <div className="holders-empty">
              <span className="big-emoji">👆</span>
              Select a unit to see which accounts have it.
            </div>
          ) : (
            <div>
              <div className="holders-header">
                <div className={`holders-icon ${rarityClass(entry.rarity)}`}>
                  <UnitIcon image={entry.icon} rawName={entry.key} />
                </div>
                <div>
                  <div className="holders-name">{entry.name}</div>
                  <div className="holders-sub">
                    Aggregate Pooled Units: <span className="accent">{formatNumber(entry.total)}</span>
                  </div>
                </div>
              </div>
              <div className="holders-divider" />
              <div className="holders-meta-row">
                <span className="holders-meta-label">
                  Held by {holders.length} farm account{holders.length === 1 ? "" : "s"}
                </span>
                <div style={{ display: "flex", gap: 8 }}>
                  {selectedHolders.size > 0 && (
                    <button className="pill green" onClick={jumpToTrade}>
                      Trade
                    </button>
                  )}
                  <button className="pill blue" onClick={copyHolders}>
                    {copyLabel ?? (selectedHolders.size > 0 ? `Copy Selected (${selectedHolders.size})` : `Copy All (${holders.length})`)}
                  </button>
                </div>
              </div>
              <div className="holders-list">
                {holders.length === 0 ? (
                  <div className="empty-state">No accounts currently hold this unit.</div>
                ) : (
                  holders.map((h, idx) => {
                    const acc = accounts?.find((a) => a.username === h.username);
                    const online = acc ? isOnline(acc) : false;
                    const selected = selectedHolders.has(h.username);
                    return (
                      <div
                        key={h.username}
                        className={`holder-row ${selected ? "selected" : ""}`}
                        onClick={(e) => handleHolderClick(e, idx, h.username)}
                      >
                        <span className={`status-dot ${online ? "" : "offline"}`} />
                        <span className="holder-name">{h.username}</span>
                        <span className="holder-qty">x{formatNumber(h.qty)} units</span>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
