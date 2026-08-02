import { useMemo, useState } from "react";
import { useGtdAccounts, realAccounts } from "../hooks/useGtdAccounts";
import { useSeedsBaseline } from "../hooks/useSeedsBaseline";
import { formatAge, formatNumber, formatSigned, isOnline } from "../lib/format";
import type { GtdAccount } from "../lib/types";

const SEEDS_ICON = "https://static.wikia.nocookie.net/gtd/images/4/4b/Seeds.png/revision/latest?cb=20250807140625";

const KEY_ITEMS = [
  { id: "unit_rafflesia", label: "Rafflesia", icon: "https://static.wikia.nocookie.net/gtd/images/f/f4/Rafflesia.png/revision/latest?cb=20260624124806" },
  { id: "unit_trident", label: "Tridenthra", icon: "https://static.wikia.nocookie.net/gtd/images/5/59/Tridenthra.png/revision/latest?cb=20260524030135" },
];

function KeyItemsCell({ acc }: { acc: GtdAccount }) {
  const inv = acc.inventory ?? [];
  return (
    <div className="badges">
      {KEY_ITEMS.map((k) => {
        const item = inv.find((i) => i && i.id === k.id);
        const has = item ? (item.count ?? 0) > 0 : false;
        return (
          <span key={k.id} className={`badge ${has ? "on" : ""}`} title={`${k.label}${has ? " — owned" : " — none"}`}>
            <img className="icon-img" src={k.icon} alt="" />
            {has ? "✓" : "✕"}
          </span>
        );
      })}
    </div>
  );
}

function ActionCell({ acc, online }: { acc: GtdAccount; online: boolean }) {
  if (!online) return <span className="action-text offline">Offline</span>;
  if (acc.action) return <span className="action-text" title={acc.action}>{acc.action}</span>;
  return <span className="action-text idle">Idle</span>;
}

function MapCell({ acc, online }: { acc: GtdAccount; online: boolean }) {
  const lobbyVal = acc.lobby || "";
  const isInLobby = !lobbyVal || lobbyVal.toLowerCase() === "lobby";
  let badgeClass = "match";
  let mapText = lobbyVal;
  if (!online) {
    badgeClass = "offline";
    mapText = "Offline";
  } else if (isInLobby) {
    badgeClass = "lobby";
    mapText = "Lobby";
  }
  return <span className={`map-badge ${badgeClass}`}>{mapText}</span>;
}

export default function AccountsPage() {
  const { data, isLoading } = useGtdAccounts();
  const baseline = useSeedsBaseline(data);
  const [filter, setFilter] = useState<"all" | "online" | "offline">("all");
  const [search, setSearch] = useState("");

  const real = useMemo(() => realAccounts(data ?? []), [data]);

  const list = useMemo(() => {
    let l = real;
    if (filter === "online") l = l.filter(isOnline);
    if (filter === "offline") l = l.filter((a) => !isOnline(a));
    if (search.trim()) {
      const q = search.trim().toLowerCase();
      l = l.filter((a) => a.username.toLowerCase().includes(q));
    }
    return [...l].sort((a, b) => a.username.localeCompare(b.username));
  }, [real, filter, search]);

  return (
    <div className="wrap" style={{ padding: 0 }}>
        <div className="panel">
          <div className="toolbar" style={{ marginBottom: 0 }}>
            <div className="search-box">
              <span>🔍</span>
              <input type="text" placeholder="Search username..." value={search} onChange={(e) => setSearch(e.target.value)} />
            </div>
            <div className="filter-pills">
              {(["all", "online", "offline"] as const).map((f) => (
                <button key={f} className={`pill ${filter === f ? "green" : "grey"}`} onClick={() => setFilter(f)}>
                  {f[0].toUpperCase() + f.slice(1)}
                </button>
              ))}
            </div>
          </div>

          <div className="table-wrap">
          <table className="grid-table">
            <colgroup>
              <col style={{ width: "17%" }} />
              <col style={{ width: "10%" }} />
              <col style={{ width: "10%" }} />
              <col style={{ width: "12%" }} />
              <col style={{ width: "13%" }} />
              <col style={{ width: "13%" }} />
              <col style={{ width: "9%" }} />
              <col style={{ width: "16%" }} />
            </colgroup>
            <thead>
              <tr>
                <th className="left">Account</th>
                <th>Seeds</th>
                <th>Seeds Today</th>
                <th>Map</th>
                <th>Gamepasses</th>
                <th title="Rafflesia &amp; Tridenthra (Godly-tier)">Key Items</th>
                <th>Status</th>
                <th>Last Seen</th>
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                <tr>
                  <td colSpan={8} className="loading-state">
                    <span className="big-emoji">🌱</span>Loading farm accounts...
                  </td>
                </tr>
              ) : list.length === 0 ? (
                <tr>
                  <td colSpan={8} className="empty-state">
                    <span className="big-emoji">🔍</span>No accounts match.
                  </td>
                </tr>
              ) : (
                list.map((acc) => {
                  const on = isOnline(acc);
                  const hasBaseline = Object.prototype.hasOwnProperty.call(baseline, acc.username);
                  const seedsToday = hasBaseline ? (acc.seeds || 0) - baseline[acc.username] : null;
                  const seedsTodayClass = seedsToday === null ? "zero" : seedsToday > 0 ? "pos" : seedsToday < 0 ? "neg" : "zero";
                  return (
                    <tr key={acc.id} className={on ? "" : "offline-row"}>
                      <td className="left">
                        <div className="user-cell">
                          <span className={`status-dot ${on ? "" : "offline"}`} />
                          <span className="name">{acc.username}</span>
                        </div>
                      </td>
                      <td>
                        <span className="seeds-cell">
                          <img className="icon-img" src={SEEDS_ICON} alt="" />
                          {formatNumber(acc.seeds)}
                        </span>
                      </td>
                      <td className={`seeds-today ${seedsTodayClass}`}>{seedsToday === null ? "—" : formatSigned(seedsToday)}</td>
                      <td>
                        <MapCell acc={acc} online={on} />
                      </td>
                      <td>
                        <div className="badges">
                          <span className={`badge ${acc.x2_seeds ? "on" : ""}`}>2× Seeds</span>
                          <span className={`badge ${acc.x3_speed ? "on" : ""}`}>3× Speed</span>
                        </div>
                      </td>
                      <td>
                        <KeyItemsCell acc={acc} />
                      </td>
                      <td>
                        <ActionCell acc={acc} online={on} />
                      </td>
                      <td className="heartbeat">{formatAge(acc)}</td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
          </div>
        </div>
    </div>
  );
}
